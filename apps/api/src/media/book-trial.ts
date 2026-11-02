/** Only these four authored, deliberately public trial videos bypass signed demo media. */
const BOOK_VIDEOS: Record<string, number> = {
  'books/lesson-01': 562,
  'books/lesson-02': 783,
  'books/lesson-03': 581,
  'books/lesson-04': 196,
};

export function bookTrialVideo(uid: string) {
  if (!Object.hasOwn(BOOK_VIDEOS, uid)) return null;
  const durationSeconds = BOOK_VIDEOS[uid];
  if (!durationSeconds) return null;
  return { path: `/videos/${uid}.mp4`, durationSeconds };
}
