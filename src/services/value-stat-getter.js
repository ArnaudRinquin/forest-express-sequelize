import { BaseOperatorDateParser, Schemas } from 'forest-express';
import Operators from '../utils/operators';
import Orm from '../utils/orm';
import FiltersParser from './filters-parser';
import QueryOptions from './query-options';

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

  this.perform = async () => {
    const aggregateField = getAggregateField();
    const aggregate = getAggregate();
    let rawPreviousInterval;

    const queryOptions = new QueryOptions(model, { includeRelations: true });
    queryOptions.filterByConditionTree(params.filters);
    const { where, include } = queryOptions.sequelizeOptions;

    if (params.filters) {
      const conditionsParser = new FiltersParser(schema, params.timezone, options);
      rawPreviousInterval = conditionsParser.getPreviousIntervalCondition(params.filters);
    }

    const countCurrent = await model.unscoped().aggregate(
      aggregateField, aggregate, { include, where },
    ) || 0;

    let countPrevious;
    if (rawPreviousInterval) {
      const formatedPreviousDateInterval = this.operatorDateParser
        .getPreviousDateFilter(rawPreviousInterval.operator, rawPreviousInterval.value);

      if (where[OPERATORS.AND]) {
        where[OPERATORS.AND].forEach((condition) => {
          if (condition[rawPreviousInterval.field]) {
            // NOTICE: Might not work on super edgy cases (when the 'rawPreviousInterval.field'
            //        appears twice ont the filters)
            // FIXME This will also break scopes if they are configured using the date field.
            condition[rawPreviousInterval.field] = formatedPreviousDateInterval;
          }
        });
      } else {
        where[rawPreviousInterval.field] = formatedPreviousDateInterval;
      }

      countPrevious = await model.unscoped().aggregate(
        aggregateField, aggregate, { include, where },
      ) || 0;
    }

    return { value: { countCurrent, countPrevious } };
  };
}

module.exports = ValueStatGetter;
