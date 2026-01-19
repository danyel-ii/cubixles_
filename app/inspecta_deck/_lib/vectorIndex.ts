export type ScoredResult = {
  id: string;
  score: number;
};

export async function semanticSearch(
  _query: string,
  _topK = 8
): Promise<ScoredResult[]> {
  return [];
}
