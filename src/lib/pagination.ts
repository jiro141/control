export async function readAllPages<T>(
  readPage: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: unknown;
  }>,
): Promise<T[]> {
  const pageSize = 500;
  const records: T[] = [];

  while (true) {
    const { data, error } = await readPage(records.length, records.length + pageSize - 1);
    if (error) throw error;
    if (!data?.length) return records;

    // The API can enforce a smaller page size than the requested range.
    records.push(...data);
  }
}
