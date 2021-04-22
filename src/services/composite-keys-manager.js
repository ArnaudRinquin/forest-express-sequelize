import _ from 'lodash';
import { Schemas } from 'forest-express';
import Operators from '../utils/operators';

/**
 * This helper class allows abstracting away the complexity
 * of using collection which have composite primary keys.
 */
class CompositeKeysManager {
  constructor(model, glue = '|') {
    this._glue = glue;
    this._model = model;
    this._schema = Schemas.schemas[model.name];
    this._Sequelize = this._model.sequelize.constructor;
  }

  /** Build sequelize where condition from a list of packed recordIds */
  getRecordsConditions(recordIds) {
    const Ops = Operators.getInstance({ Sequelize: this._Sequelize });
    if (recordIds.length === 0) {
      throw new Error('At least one recordId must be provided');
    }

    // If the ids are not composite, use a IN.
    if (!this._schema.isCompositePrimary) {
      return { [this._schema.idField]: recordIds };
    }

    return recordIds.length === 1
      ? this._getRecordConditions(recordIds[0])
      : { [Ops.OR]: recordIds.map((recordId) => this._getRecordConditions(recordId)) };
  }

  /* Annotate records with their packed primary key */
  annotateRecords(records) {
    if (this._schema.isCompositePrimary) {
      records.forEach((record) => {
        record.forestCompositePrimary = this._createCompositePrimary(record);
      });
    }
  }

  /** Build sequelize where condition from a single packed recordId */
  _getRecordConditions(recordId) {
    const primaryKeyValues = this._getPrimaryKeyValues(recordId);

    // Invalid id => return no records.
    if (primaryKeyValues.length !== _.keys(this._model.primaryKeys).length) {
      return this._Sequelize.literal('(0=1)');
    }

    const where = {};
    _.keys(this._model.primaryKeys).forEach((primaryKey, index) => {
      where[primaryKey] = primaryKeyValues[index];
    });

    return where;
  }

  /** Create packed recordId from record */
  _createCompositePrimary(record) {
    let compositePrimary = '';

    _.keys(this._model.primaryKeys).forEach((primaryKey, index) => {
      // Prevent liana to crash when a composite primary keys is null,
      // this behaviour should be avoid instead of fixed.
      if (record[primaryKey] === null) {
        record[primaryKey] = 'null';
      }
      if (index === 0) {
        compositePrimary = record[primaryKey];
      } else {
        compositePrimary = compositePrimary + this._glue + record[primaryKey];
      }
    });

    return compositePrimary;
  }

  /** Unpack recordId into an array */
  _getPrimaryKeyValues(recordId) {
    // Prevent liana to crash when a composite primary keys is null,
    // this behaviour should be avoid instead of fixed.
    return recordId
      .split(this._glue)
      .map((key) => (key === 'null' ? null : key));
  }
}

module.exports = CompositeKeysManager;
