import CompositeKeysManager from './composite-keys-manager';
import ResourcesGetter from './resources-getter';

class HasManyGetter extends ResourcesGetter {
  constructor(model, association, lianaOptions, params) {
    super(association, lianaOptions, params);

    this._rootModel = model.unscoped();
  }

  async _getRecords() {
    const { associationName, recordId } = this._params;
    const options = await this._buildQueryOptions({ tableAlias: associationName });

    const record = await this._rootModel.findOne({
      // Don't fetch parent attributes (perf)
      attributes: [],

      // We are ordering with the relation
      // https://github.com/sequelize/sequelize/issues/4553#issuecomment-213989980
      order: options.order.map((o) => [this._model, ...o]),
      offset: options.offset,
      limit: options.limit,
      where: new CompositeKeysManager(this._rootModel).getRecordsConditions([recordId]),
      subQuery: false,
      include: [{
        model: this._model,
        as: associationName,
        scope: false,
        required: false,
        where: options.where,
        include: options.include,
      }],
    });

    return (record && record[associationName]) || [];
  }

  async count() {
    const { associationName, recordId } = this._params;
    const options = await this._buildQueryOptions({ forCount: true, tableAlias: associationName });

    return this._rootModel.count({
      where: new CompositeKeysManager(this._rootModel).getRecordsConditions([recordId]),
      include: [{
        model: this._model,
        as: associationName,
        required: true,
        scope: false,
        where: options.where,
        include: options.include,
      }],
    });
  }
}

module.exports = HasManyGetter;
