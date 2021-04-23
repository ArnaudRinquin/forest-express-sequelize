import { logger, Schemas } from 'forest-express';
import _ from 'lodash';
import Operators from '../utils/operators';
import CompositeKeysManager from './composite-keys-manager';
import { ErrorHTTP422 } from './errors';
import FiltersParser from './filters-parser';
import LiveQueryChecker from './live-query-checker';
import QueryBuilder from './query-builder';
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
    const { AND } = Operators.getInstance({ Sequelize: this._Sequelize });

    // Used for failed search, and when retricting to empty lists of ids.
    // Saves us from having to deal with thoses cases in all charts, ressources-getter, ...
    if (this._returnZeroRecords) {
      return { where: this._Sequelize.literal('(0=1)') };
    }

    // Compute includes from the fields that we need for the request
    const fields = [...this._requestedFields, ...this._neededFields];
    const include = [
      ...this._include,
      ...new QueryBuilder().getIncludes(this._model, fields.length ? fields : null),
    ];

    const options = {};
    if (this._where.length === 1) [options.where] = this._where;
    if (this._where.length > 1) options.where = { [AND]: this._where };
    if (include.length) options.include = include;
    if (this._order.length) options.order = this._order;
    if (this._offset !== undefined) options.offset = this._offset;
    if (this._limit !== undefined) options.limit = this._limit;
    return options;
  }

  /**
   * @param {sequelize.model} model Sequelize model that should be targeted
   * @param {boolean} options.includeRelations Include BelongsTo and HasOne relations by default
   * @param {boolean} options.tableAlias Alias that will be used for this table on the final query
   *  This should have been handled by sequelize but it was needed in order to use
   *  sequelize.fn('lower', sequelize.col('<alias>.col')) in the search-builder with
   *  has-many-getter.
   */
  constructor(model, options = {}) {
    this._Sequelize = model.sequelize.constructor;
    this._schema = Schemas.schemas[model.name];
    this._model = model.unscoped();
    this._options = options;

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
    this._offset = undefined;
    this._limit = undefined;

    if (this._options.includeRelations) {
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
    if (fields) {
      fields.forEach(this._requestedFields.add, this._requestedFields);
    }
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
    const filterParser = new FiltersParser(this._schema, timezone, { Sequelize: this._Sequelize });

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
      { Sequelize: this._Sequelize },
      { search, searchExtended },
      [...this._requestedFields],
    );

    const conditions = searchBuilder.perform(this._options.tableAlias);
    const hasCustomFieldSearch = searchBuilder.injectSmartFieldSearch(conditions);
    const searchedFields = searchBuilder.getFieldsSearched();

    // FIXME retrocompatibility, would be better to check if condition is empty.
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

    const segment = this._schema.segments?.find((s) => s.name === name);

    // Segments can be provided as a sequelize scope
    // FIXME bugged
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
      const options = { type: this._Sequelize.QueryTypes.SELECT };
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

    let order = 'ASC';
    if (sortString[0] === '-') {
      sortString = sortString.substring(1);
      order = 'DESC';
    }

    if (sortString.indexOf('.') !== -1) {
      // Sort on the belongsTo displayed field
      const [associationName, fieldName] = sortString.split('.');
      this._order.push([associationName, fieldName, order]);
      this._neededFields.add(sortString);
    } else {
      this._order.push([sortString, order]);
    }
  }

  /**
   * Apply pagination.
   * When called with invalid parameters the query will be paginated using default values.
   *
   * @param {number|string} number page number (starting at one)
   * @param {number|string} size page size
   */
  async paginate(number, size) {
    const limit = Number.parseInt(size, 10);
    const offset = (Number.parseInt(number, 10) - 1) * limit;

    if (offset >= 0 && limit > 0) {
      this._offset = offset;
      this._limit = limit;
    } else {
      this._offset = 0;
      this._limit = 10;
    }
  }
}

module.exports = QueryOptions;
