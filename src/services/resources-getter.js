import _ from 'lodash';
import { Schemas } from 'forest-express';
import CompositeKeysManager from './composite-keys-manager';
import QueryOptions from './query-options';
import extractRequestedFields from './requested-fields-extractor';

class ResourcesGetter {
  constructor(model, lianaOptions, params) {
    // The liana options argument is kept for retro-compatibility.
    this._model = model.unscoped();
    this._params = params;
  }

  async perform() {
    return [
      await this._getRecords(),
      await this._getFieldsSearched(),
    ];
  }

  /** Count records matching current query (wo/ pagination) */
  async count() {
    const options = await this._buildQueryOptions(true);

    // If no primary key is found, use * as a fallback for Sequelize.
    if (_.isEmpty(this._model.primaryKeys)) options.col = '*';

    return this._model.count(options);
  }

  /** Load records matching current query (w/ pagination) */
  async _getRecords() {
    const options = await this._buildQueryOptions();
    const records = await this._model.findAll(options);
    new CompositeKeysManager(this._model).annotateRecords(records);
    return records;
  }

  /** Get list of fields descriptors which are used when searching (frontend highlighting). */
  async _getFieldsSearched() {
    const { fields, search, searchExtended } = this._params;
    const requestedFields = extractRequestedFields(fields, this._model, Schemas.schemas);

    const queryOptions = new QueryOptions(this._model);
    await queryOptions.requireFields(requestedFields);
    return queryOptions.search(search, searchExtended);
  }

  /** Compute query options which are shared for count() and getRecords() */
  async _buildQueryOptions(forCount = false) {
    const {
      fields, filters, search, searchExtended, segment, segmentQuery, timezone,
    } = this._params;

    const requestedFields = extractRequestedFields(fields, this._model, Schemas.schemas);
    const queryOptions = new QueryOptions(this._model);
    await queryOptions.requireFields(requestedFields);
    await queryOptions.search(search, searchExtended);
    await queryOptions.filterByConditionTree(filters, timezone);
    await queryOptions.segment(segment);
    await queryOptions.segmentQuery(segmentQuery);

    if (!forCount) {
      const { sort, page } = this._params;
      await queryOptions.sort(sort);
      await queryOptions.paginate(page?.number, page?.size);
    }

    return queryOptions.sequelizeOptions;
  }
}

module.exports = ResourcesGetter;
