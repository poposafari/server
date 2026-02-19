import z from 'zod';
import { STARTING_TOTAL } from './game.constant';

/** POST 스타팅 선택 요청 (0 ~ STARTING_TOTAL - 1) */
export const catchStartingSchema = z.object({
  index: z.coerce
    .number()
    .int('index must be an integer')
    .min(0, 'index must be at least 0')
    .max(STARTING_TOTAL - 1, `index must be at most ${STARTING_TOTAL - 1}`),
});

//TODO: 이건 무슨 문법이지? 나중에 알아보자.
// export type CatchStartingSchema = z.infer<typeof catchStartingSchema>;
