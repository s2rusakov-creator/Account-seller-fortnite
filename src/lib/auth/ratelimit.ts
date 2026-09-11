import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Ограничение частоты запросов.
 *
 * Ключ в заголовке защищает от чужих, но не от своего же кода: `/api/img`
 * проксирует каждую картинку сетки, а их больше тысячи, и один цикл в боте
 * или повторный рендер за ночь превращается в счёт за трафик и в блокировку
 * со стороны fortnite-api.
 *
 * Счётчик скользящий, общий для всех инстансов — иначе на serverless он
 * считал бы отдельно в каждом холодном процессе и не значил бы ничего.
 * Без переменных Upstash ограничение просто выключено: оно полезное, но не
 * настолько, чтобы из-за него не открылся сервис.
 */

const WINDOW = '1 m';

/** Картинки идут пачками: сетка тянет их сотнями за один показ. */
const IMAGE_LIMIT = 600;

/** Всё остальное — это действия человека, их столько не бывает. */
const DEFAULT_LIMIT = 60;

function redis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

let heavy: Ratelimit | null = null;
let normal: Ratelimit | null = null;
let ready = false;

function limiters() {
  if (!ready) {
    const client = redis();
    if (client) {
      heavy = new Ratelimit({
        redis: client,
        limiter: Ratelimit.slidingWindow(IMAGE_LIMIT, WINDOW),
        prefix: 'rl:img',
      });
      normal = new Ratelimit({
        redis: client,
        limiter: Ratelimit.slidingWindow(DEFAULT_LIMIT, WINDOW),
        prefix: 'rl:api',
      });
    }
    ready = true;
  }
  return { heavy, normal };
}

/**
 * Разрешён ли ещё один запрос.
 *
 * `who` — тот, кого считаем: метка ключа или Telegram ID продавца, а не IP.
 * У Vercel исходящий адрес плавает, и считать по нему бессмысленно.
 */
export async function allowRequest(who: string, pathname: string): Promise<boolean> {
  const { heavy: images, normal: rest } = limiters();
  const limiter = pathname.startsWith('/api/img') ? images : rest;
  if (!limiter) return true;

  try {
    const { success } = await limiter.limit(who);
    return success;
  } catch {
    // Хранилище недоступно — это не повод закрывать сервис.
    return true;
  }
}
