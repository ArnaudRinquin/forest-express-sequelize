import { BaseOperatorDateParser, Schemas } from 'forest-express';
import Operators from '../utils/operators';
import Orm from '../utils/orm';
import FiltersParser from './filters-parser';
import QueryOptions from './query-options';

function ValueStatGetter(model, params, options) {
  const OPERATORS = Operators.getInstance(options);
  const schema = Schemas.schemas[model.name];
  const operatorDateParser = new BaseOperatorDateParser({
    operators: OPERATORS, timezone: params.timezone,
  });

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

  this.getCountCurrent = async (aggregateField, aggregate, sequelizeOptions) => {
    const count = await model.unscoped().aggregate(aggregateField, aggregate, sequelizeOptions);
    return count ?? 0;
  };

  /**
   * Modify the filter, and fetch the value for the previous period.
   *
   * FIXME Will not work on edges cases
   * - when the 'rawPreviousInterval.field' appears twice
   * - when scopes use the same field as the filter
   */
  this.getCountPrevious = async (aggregateField, aggregate, sequelizeOptions) => {
    if (!params.filters) { return undefined; }

    const conditionsParser = new FiltersParser(schema, params.timezone, options);
    const rawInterval = conditionsParser.getPreviousIntervalCondition(params.filters);
    if (!rawInterval) { return undefined; }

    const interval = operatorDateParser.getPreviousDateFilter(
      rawInterval.operator, rawInterval.value,
    );

    if (sequelizeOptions.where[OPERATORS.AND]) {
      sequelizeOptions.where[OPERATORS.AND]
        .filter((c) => c[rawInterval.field])
        .forEach((condition) => { condition[rawInterval.field] = interval; });
    } else {
      sequelizeOptions.where[rawInterval.field] = interval;
    }

    const count = await model.unscoped().aggregate(aggregateField, aggregate, sequelizeOptions);
    return count || 0;
  };


  this.perform = async () => {
    const aggregateField = getAggregateField();
    const aggregate = getAggregate();

    const queryOptions = new QueryOptions(model, { includeRelations: true });
    queryOptions.filterByConditionTree(params.filters);

    const { sequelizeOptions } = queryOptions;
    sequelizeOptions.include = sequelizeOptions.include
      ? sequelizeOptions.include.map((i) => ({ ...i, attributes: [] }))
      : undefined;

    return {
      value: {
        countCurrent: await this.getCountCurrent(aggregateField, aggregate, sequelizeOptions),
        countPrevious: await this.getCountPrevious(aggregateField, aggregate, sequelizeOptions),
      },
    };
  };
}

module.exports = ValueStatGetter;
