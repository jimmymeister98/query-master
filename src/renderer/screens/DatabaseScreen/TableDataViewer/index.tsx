import { qb } from 'libs/QueryBuilder';
import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  SetStateAction,
  Dispatch,
} from 'react';
import QueryResultTable from '../QueryResultViewer/QueryResultTable';
import { useSqlExecute } from 'renderer/contexts/SqlExecuteProvider';
import {
  QueryResult,
  QueryResultHeader,
  QueryResultWithIndex,
} from 'types/SqlResult';
import Layout from 'renderer/components/Layout';
import Toolbar from 'renderer/components/Toolbar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronLeft,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { EditableQueryResultProvider } from 'renderer/contexts/EditableQueryResultProvider';
import QueryResultLoading from '../QueryResultViewer/QueryResultLoading';
import { useDialog } from 'renderer/contexts/DialogProvider';
import CommitChangeToolbarItem from '../QueryResultViewer/CommitChangeToolbarItem';
import { transformResultHeaderUseSchema } from 'libs/TransformResult';
import { useSchema } from 'renderer/contexts/SchemaProvider';

interface TableDataViewerProps {
  databaseName: string;
  tableName: string;
  tabKey: string;
  name: string;
}

type SortedHeader =
  | {
      by: 'ASC' | 'DESC';
      header: QueryResultHeader;
    }
  | undefined;

const PAGE_SIZE = 200;

function TableDataViewerBody({
  result,
  setResult,
  totalRows,
  page,
  refresh,
  sortedHeader,
  setSortedHeader,
  setPage,
}: {
  result: QueryResult<Record<string, unknown>>;
  setResult: Dispatch<SetStateAction<QueryResult<Record<string, unknown>>>>;
  totalRows: number | null;
  page: number;
  refresh: () => void;
  sortedHeader: SortedHeader;
  setSortedHeader: React.Dispatch<React.SetStateAction<SortedHeader>>;
  setPage: Dispatch<SetStateAction<number>>;
}) {
  const data = useMemo<QueryResultWithIndex[]>(
    () =>
      result.rows.map((row, idx) => ({
        rowIndex: idx,
        data: row,
      })),
    [result]
  );

  const headers = result.headers;
  const rowRange = {
    start: page * PAGE_SIZE,
    end: page * PAGE_SIZE + result.rows.length,
  };

  const onNextPage = useCallback(() => {
    setPage((prev) => prev + 1);
  }, [setPage]);

  const onPrevPage = useCallback(() => {
    setPage((prev) => prev - 1);
  }, [setPage]);

  const footer = (
    <Toolbar shadowTop>
      {result && (
        <CommitChangeToolbarItem
          result={result}
          onResultChange={setResult}
          onRequestRefetch={refresh}
        />
      )}
      <Toolbar.Filler />
      <Toolbar.Item
        icon={<FontAwesomeIcon icon={faChevronLeft} />}
        disabled={page === 0}
        onClick={onPrevPage}
      />
      <Toolbar.Text>
        {rowRange.start}-{rowRange.end}/
        {totalRows === null
          ? 'unknown'
          : totalRows.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </Toolbar.Text>
      <Toolbar.Item
        disabled={data.length === 0}
        icon={<FontAwesomeIcon icon={faChevronRight} />}
        onClick={onNextPage}
      />
    </Toolbar>
  );

  return (
    <EditableQueryResultProvider>
      <Layout>
        <Layout.Grow>
          <div style={{ width: '100%', height: '100%', display: 'flex' }}>
            <QueryResultTable
              headers={headers}
              result={data}
              onSortHeader={(header, by) => setSortedHeader({ by, header })}
              onSortReset={() => setSortedHeader(undefined)}
              sortedHeader={sortedHeader}
            />
          </div>
        </Layout.Grow>
        <Layout.Fixed>{footer}</Layout.Fixed>
      </Layout>
    </EditableQueryResultProvider>
  );
}

export default function TableDataViewer({
  databaseName,
  tableName,
}: TableDataViewerProps) {
  const { schema } = useSchema();
  const { runner, common } = useSqlExecute();
  const [result, setResult] = useState<QueryResult<Record<string, unknown>>>();
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const { showErrorDialog } = useDialog();
  const [loading, setLoading] = useState(true);
  const [sortedHeader, setSortedHeader] = useState<SortedHeader>();
  const [page, setPage] = useState(0);

  useEffect(() => {
    common.estimateTableRowCount(databaseName, tableName).then(setTotalRows);
  }, [databaseName, tableName, setTotalRows]);

  useEffect(() => {
    const builder = qb()
      .table(`${databaseName}.${tableName}`)
      .select()
      .offset(PAGE_SIZE * page)
      .limit(PAGE_SIZE);

    if (sortedHeader) {
      builder.orderBy(sortedHeader.header.name, sortedHeader.by);
    }

    const selectSql = builder.toRawSQL();

    setLoading(true);
    runner
      .execute([{ sql: selectSql }], {
        skipProtection: true,
      })
      .then((result) => {
        const transformResult = transformResultHeaderUseSchema(result, schema);
        setResult(transformResult[0].result);
        setLoading(false);
      })
      .catch((e) => {
        if (e.message) {
          showErrorDialog(e.message);
        }
      });
  }, [
    runner,
    page,
    sortedHeader,
    setTotalRows,
    setLoading,
    setResult,
    refreshCounter,
  ]);

  if (loading || !result) {
    return (
      <Layout>
        <Layout.Grow></Layout.Grow>
        <Layout.Fixed>
          <QueryResultLoading />
        </Layout.Fixed>
      </Layout>
    );
  }

  return (
    <TableDataViewerBody
      result={result}
      setResult={
        setResult as Dispatch<
          SetStateAction<QueryResult<Record<string, unknown>>>
        >
      }
      totalRows={totalRows}
      page={page}
      setPage={setPage}
      // This will cause the code to refresh the result
      refresh={() => setRefreshCounter((prev) => prev + 1)}
      // Handle sorting
      sortedHeader={sortedHeader}
      setSortedHeader={setSortedHeader}
    />
  );
}
