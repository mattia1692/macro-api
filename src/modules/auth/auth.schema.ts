import { z } from 'zod';

export const loginBodySchema = z.object({
  firebaseToken: z.string().min(1),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
