import _ from 'lodash';
import { Schemas, BaseOperatorDateParser } from 'forest-express';
import Operators from '../utils/operators';
import FiltersParser from './filters-parser';
import Orm from '../utils/orm';

function ValueStatGetter(model, params, options) {
  const OPERATORS = Operators.getInstance(options);

  this.operatorDateParser = new BaseOperatorDateParser({
    operators: OPERATORS,
    timezone: params.timezone,
  });

  const schema = Schemas.schemas[model.name];
  function getAggregate() {
    return params.aggregate.toLowerCase();
  }

  function getAggregateField() {
    // NOTICE: As MySQL cannot support COUNT(table_name.*) syntax, fieldName cannot be '*'.
    const fieldName = params.aggregate_field
      || schema.primaryKeys[0]
      || schema.fields[0].field;
    return `${schema.name}.${Orm.getColumnName(schema, fieldName)}`;
  }

  function getIncludes() {
    const includes = [];
    _.values(model.associations).forEach((association) => {
      if (['HasOne', 'BelongsTo'].indexOf(association.associationType) > -1) {
        includes.push({
          model: association.target.unscoped(),
          as: association.associationAccessor,
          attributes: [],
        });
      }
    });

    return includes;
  }

  this.perform = async () => {
    let countCurrent;
    const aggregateField = getAggregateField();
    const aggregate = getAggregate();
    let where;
    let rawPreviousInterval;
    if (params.filters) {
      const conditionsParser = new FiltersParser(schema, params.timezone, options);
      where = await conditionsParser.perform(params.filters);
      rawPreviousInterval = conditionsParser.getPreviousIntervalCondition(params.filters);
    }

    return model
      .unscoped()
      .aggregate(aggregateField, aggregate, {
        include: getIncludes(),
        where,
      })
      .then((count) => {
        countCurrent = count || 0;

        if (rawPreviousInterval) {
          const formatedPreviousDateInterval = this.operatorDateParser
            .getPreviousDateFilter(rawPreviousInterval.operator, rawPreviousInterval.value);

          if (where[OPERATORS.AND]) {
            where[OPERATORS.AND].forEach((condition) => {
              if (condition[rawPreviousInterval.field]) {
                // NOTICE: Might not work on super edgy cases (when the 'rawPreviousInterval.field'
                //        appears twice ont the filters)
                condition[rawPreviousInterval.field] = formatedPreviousDateInterval;
              }
            });
          } else {
            where[rawPreviousInterval.field] = formatedPreviousDateInterval;
          }

          return model
            .unscoped()
            .aggregate(aggregateField, aggregate, {
              include: getIncludes(),
              where,
            })
            .then((resultCount) => resultCount || 0);
        }
        return undefined;
      })
      .then((countPrevious) => ({
        value: {
          countCurrent,
          countPrevious,
        },
      }));
  };
}

module.exports = ValueStatGetter;
