/** Only known local publication parameters survive the Telegram login redirect. */
export function publicationTarget(search: string): string {
  const source = new URLSearchParams(search);
  const target = new URLSearchParams();
  const dealId = source.get('dealId');
  const tag = source.get('tag');
  if (dealId && /^\w{1,64}$/.test(dealId)) target.set('dealId', dealId);
  if (tag && /^#?[a-z0-9]{3,30}$/i.test(tag)) target.set('tag', tag);
  return target.size ? '/?' + target.toString() : '/';
}
