/** A forced POST must finish before replacing the editor's existing correction.
 * Polling GET is unsafe: the store can serve yesterday's artifact while its
 * generation lock is held by another request.
 */
export async function requestRegeneratedSubtitle(
  request: () => Promise<Response>,
  options: {
    isCurrent: () => boolean;
    wait?: () => Promise<void>;
    maxPolls?: number;
  },
): Promise<Response> {
  const check = () => {
    if (!options.isCurrent()) throw new DOMException('Subtitle request superseded', 'AbortError');
  };
  const wait = options.wait || (() => new Promise<void>((resolve) => setTimeout(resolve, 1500)));
  check();
  let response = await request();
  for (let poll = 0; response.status === 202 && poll < (options.maxPolls ?? 20); poll += 1) {
    check();
    await wait();
    check();
    response = await request();
  }
  check();
  if (response.status === 202) throw new Error('Server đang tạo subtitle. Hãy thử lại sau ít phút.');
  return response;
}
