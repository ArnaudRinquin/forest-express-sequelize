import { logger, Schemas } from 'forest-express';
import _ from 'lodash';
import Operators from '../utils/operators';
import QueryUtils from '../utils/query';
import CompositeKeysManager from './composite-keys-manager';
import { ErrorHTTP422 } from './errors';
import FiltersParser from './filters-parser';
import LiveQueryChecker from './live-query-checker';
import SearchBuilder from './search-builder';

/**
 * Sequelize query options generator which is configured using forest admin concepts (filters,
 * search, segments, ...).
 * Those can be used for update, findAll, destroy, ...
 */
class QueryOptions {
  /**
   * Query options which can be used with sequelize.
   * i.e: Books.findAll(queryOptions.sequelizeOptions);
   */
  get sequelizeOptions() {
    // Used for failed search, and when retricting to empty lists of ids.
    // Saves us from having to deal with thoses cases in all charts, ressources-getter, ...
    if (this._returnZeroRecords) {
      const Sequelize = this._model.sequelize.constructor;
      return { where: Sequelize.literal('(0=1)') };
    }

    // Compute includes from the fields that we need for the request
    let include = [
      ...this._include,
      ...this._computeIncludesFor([...this._requestedFields, ...this._neededFields]),
    ];

    if (include.length === 0) {
      include = undefined; // Work around Sequelize 4.8.x bug
    }

    // It was more convenient to store where clauses as an array.
    const { AND } = Operators.getInstance({ Sequelize: this._model.sequelize.constructor });
    const where = { [AND]: this._where };

    return {
      include,
      where,
      order: this._order,
      offset: this._offset,
      limit: this._limit,
    };
  }

  constructor(model, options = {}) {
    this._model = model.unscoped();
    this._returnZeroRecords = false;

    // Used to compute relations that will go in the final 'include'
    this._requestedFields = new Set();
    this._neededFields = new Set();

    // This is used only to support segments defined as a sequelize scope.
    // Should be removed once that feature is dropped (it's _not_ in the documentation).
    this._include = [];

    // Other sequelize params
    this._where = [];
    this._order = [];
    this._offset = 0;
    this._limit = 10;

    if (options.includeRelations) {
      _.values(this._model.associations).forEach((association) => {
        if (['HasOne', 'BelongsTo'].includes(association.associationType)) {
          this._requestedFields.add(association.associationAccessor);
        }
      });
    }
  }

  /**
   * Add the required includes from a list of field names.
   * Field names of HasOne and BelongTo relations are accepted (ie. 'book.name').
   * @param {string[]} fields
   */
  async requireFields(fields) {
    fields.forEach(this._requestedFields.add, this._requestedFields);
  }

  /**
   * Filter resulting query set with packed primary ids.
   * This works both for normal collection, and those which use composite primary keys.
   * @param {string[]} recordIds Packed record ids
   */
  async filterByIds(recordIds) {
    if (recordIds.length) {
      const keyManager = new CompositeKeysManager(this._model);
      this._where.push(keyManager.getRecordsConditions(recordIds));
    } else {
      this._returnZeroRecords = true;
    }
  }

  /**
   * Apply condition tree to those query options (scopes, user filters, charts, ...)
   * @param {*} filters
   * @param {*} timezone
   */
  async filterByConditionTree(filters, timezone) {
    const schema = Schemas.schemas[this._model.name];
    const options = { Sequelize: this._model.sequelize.constructor };
    const filterParser = new FiltersParser(schema, timezone, options);

    if (filters) {
      const whereClause = await filterParser.perform(filters);
      this._where.push(whereClause);

      const associations = await filterParser.getAssociations(filters);
      associations.forEach(this._neededFields.add, this._neededFields);
    }
  }

  /**
   *
   * @param {string} search
   * @param {boolean|string} searchExtended
   */
  async search(search, searchExtended) {
    if (!search) return [];

    const searchBuilder = new SearchBuilder(
      this._model,
      { Sequelize: this._model.sequelize.constructor },
      { search, searchExtended },
      [...this._requestedFields],
    );

    const conditions = searchBuilder.perform();

    // Custom field search definition adds custom conditions to the query where clause.
    let hasCustomFieldSearch = false;
    Schemas.schemas[this._model.name].fields.forEach((field) => {
      if (!field.search) return;

      const Ops = Operators.getInstance({ Sequelize: this._model.sequelize.constructor });
      try {
        // Retrocompatibility: customers which implement search on smart fields are expected to
        // inject their conditions at .where[Op.and][0][Op.or].push(searchCondition)
        // https://docs.forestadmin.com/documentation/reference-guide/fields/create-and-manage-smart-fields
        const fakeQuery = { include: [], where: { [Ops.AND]: [conditions] } };
        field.search(fakeQuery, search);
        this._include.push(...fakeQuery.include);
        hasCustomFieldSearch = true;
      } catch (error) {
        logger.error(`Cannot search properly on Smart Field ${field.field}`, error);
      }
    });

    const searchedFields = searchBuilder.getFieldsSearched();
    const searchFailed = searchedFields.length === 0 && !hasCustomFieldSearch
      && (!searchExtended || !searchBuilder.hasExtendedSearchConditions());

    if (searchFailed) {
      this._returnZeroRecords = true;
    } else {
      this._where.push(conditions);
    }

    return searchedFields;
  }

  /**
   * Apply a forestadmin segment
   * @param {string} name name of the segment (from the querystring)
   * @param {string} segmentQuery SQL query of the segment (also from querystring)
   */
  async segment(name) {
    if (!name) return;

    const schema = Schemas.schemas[this._model.name];
    const segment = schema.segments?.find((s) => s.name === name);

    // Segments can be provided as a sequelize scope
    // UNDOCUMENTED Should this feature be kept?
    if (segment?.scope) {
      this._model = this._model.scope(segment.scope);
    }

    // ... or as a function which returns a sequelize where clause ...
    if (typeof segment?.where === 'function') {
      this._where.push(await segment.where());
    }
  }

  /**
   * Apply a segment query.
   * FIXME Select SQL injection allows to fetch any information from database.
   */
  async segmentQuery(query) {
    if (!query) return;

    const [primaryKey] = _.keys(this._model.primaryKeys);
    const queryToFilterRecords = query.trim();

    new LiveQueryChecker().perform(queryToFilterRecords);

    try {
      const Sequelize = this._model.sequelize.constructor;
      const options = { type: Sequelize.QueryTypes.SELECT };
      const records = await this._model.sequelize.query(queryToFilterRecords, options);
      const recordIds = records.map((result) => result[primaryKey] || result.id);

      this.filterByIds(recordIds);
    } catch (error) {
      const errorMessage = `Invalid SQL query for this Live Query segment:\n${error.message}`;
      logger.error(errorMessage);
      throw new ErrorHTTP422(errorMessage);
    }
  }

  /**
   * Apply sort instructions from a sort string in the form 'field', '-field' or 'field.subfield'.
   * Multiple sorts are not supported
   *
   * @param {string} sortString a sort string
   */
  async sort(sortString) {
    if (!sortString) {
      return;
    }

    const Sequelize = this._model.sequelize.constructor;
    const schema = Schemas.schemas[this._model.name];

    let order = 'ASC';
    if (sortString[0] === '-') {
      sortString = sortString.substring(1);
      order = 'DESC';
    }

    if (sortString.indexOf('.') !== -1) {
      // Sort on the belongsTo displayed field
      const [associationName, fieldName] = sortString.split('.');
      const column = QueryUtils.getReferenceField(
        Schemas.schemas, schema, associationName, fieldName,
      );

      this._order.push([Sequelize.col(column), order]);
      this._neededFields.add(sortString);
    } else {
      this._order.push([sortString, order]);
    }
  }

  /**
   * Apply pagination
   *
   * @param {number|string} number page number (starting at one)
   * @param {number|string} size page size
   */
  async paginate(number, size) {
    const limit = Number.parseInt(size, 10);
    const offset = (Number.parseInt(number, 10) - 1) * limit;

    if (!Number.isNaN(limit) && !Number.isNaN(offset)) {
      this._offset = offset;
      this._limit = limit;
    }
  }

  /**
   * Compute "includes" parameter which is expected by sequelize from a list of fields.
   * The list of fields can contain fields from relations in the form 'author.firstname'
   *
   * @param {string[]} fieldNames model and relationship field names
   */
  _computeIncludesFor(fieldNames) {
    /**
     * @param {string[]} values
     * @returns {string[]}
     */
    function _uniqueValues(values) {
      return Array.from(new Set(values));
    }

    /**
     * @param {string} key
     * @param {sequelize.Association} association
     * @returns {string}
     */
    function _getTargetFieldName(key, association) {
    // Defensive programming
      if (key && association.target.tableAttributes[key]) {
        return association.target.tableAttributes[key].fieldName;
      }

      return undefined;
    }

    /**
     * @param {sequelize.HasOne|sequelize.BelongsTo} association
     * @returns {string[]}
     */
    function _getMandatoryFields(association) {
      return association.target.primaryKeyAttributes
        .map((attribute) => _getTargetFieldName(attribute, association));
    }

    const includes = [];

    Object.values(this._model.associations)
      .filter((association) => ['HasOne', 'BelongsTo'].includes(association.associationType))
      .forEach((association) => {
        const targetFields = Object.values(association.target.tableAttributes)
          .map((attribute) => attribute.fieldName);

        const explicitAttributes = (fieldNames || [])
          .filter((name) => name.startsWith(`${association.as}.`))
          .map((name) => name.replace(`${association.as}.`, ''))
          .filter((fieldName) => targetFields.includes(fieldName));

        if (!fieldNames
          || fieldNames.includes(association.as)
          || explicitAttributes.length) {
          // NOTICE: For performance reasons, we only request the keys
          //         as they're the only needed fields for the interface
          const uniqueExplicitAttributes = _uniqueValues([
            ..._getMandatoryFields(association),
            ...explicitAttributes,
          ].filter(Boolean));

          const attributes = explicitAttributes.length
            ? uniqueExplicitAttributes
            : undefined;

          includes.push({
            model: association.target.unscoped(),
            as: association.associationAccessor,
            attributes,
          });
        }
      });

    return includes;
  }
}

module.exports = QueryOptions;
