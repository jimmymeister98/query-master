import WindowTab from 'renderer/components/WindowTab';
import QueryResultViewer from './QueryResultViewer';
import { useMemo, useState, memo } from 'react';
import { SqlStatementResult } from 'libs/SqlRunnerManager';

interface QueryMultipleResultViewerProps {
  value: SqlStatementResult[];
}

export default memo(function QueryMultipleResultViewer({
  value,
}: QueryMultipleResultViewerProps) {
  const queryResultOnly = useMemo(() => {
    return value.filter((v) => !v.result.resultHeader);
  }, [value]);
  const [selected, setSelected] = useState(`query_0`);

  if (queryResultOnly.length === 0) return <div />;
  if (queryResultOnly.length === 1)
    return <QueryResultViewer statementResult={value[0]} />;

  return (
    <WindowTab
      selected={selected}
      onTabChanged={(tab) => setSelected(tab.key)}
      tabs={queryResultOnly.map((result, idx) => {
        return {
          component: <QueryResultViewer statementResult={result} />,
          key: `query_${idx}`,
          name: `Query ${idx + 1}`,
        };
      })}
    />
  );
});
