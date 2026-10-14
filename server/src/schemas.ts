import { z } from 'zod'

const cleanText = (value: string) =>
  value.replace(/\u0000/g, '').replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
const text = (max: number) => z.string().transform(cleanText).pipe(z.string().max(max))

export const uuidSchema = z.string().uuid()

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date.')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, 'Expected a valid calendar date.')

export const subtaskSchema = z
  .object({
    id: uuidSchema.optional(),
    title: text(200).pipe(z.string().trim().min(1)),
    done: z.boolean().default(false),
  })
  .strict()

export const followUpSchema = z
  .object({
    id: uuidSchema.optional(),
    date: isoDateSchema,
    note: text(1000).default(''),
    completed: z.boolean().default(false),
  })
  .strict()

export const taskInputSchema = z
  .object({
    title: text(200).pipe(z.string().trim().min(1)),
    description: text(10000).default(''),
    status: z.enum(['todo', 'in-progress', 'completed', 'on-hold']).default('todo'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    category: text(80).pipe(z.string().trim().min(1)),
    dueDate: isoDateSchema.nullable().default(null),
    assignedTo: uuidSchema.nullable().optional(),
    subtasks: z.array(subtaskSchema).max(100).default([]),
    followUps: z.array(followUpSchema).max(100).default([]),
  })
  .strict()
  .superRefine((value, context) => {
    if (!uniqueNestedIds(value.subtasks)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['subtasks'], message: 'Subtask IDs must be unique.' })
    }
    if (!uniqueNestedIds(value.followUps)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['followUps'], message: 'Follow-up IDs must be unique.' })
    }
  })

export type TaskInput = z.infer<typeof taskInputSchema>

export const legacyImportTaskSchema = z
  .object({
    id: uuidSchema.optional(),
    title: z
      .string()
      .transform((value) => cleanText(value).trim())
      .pipe(z.string().min(1).max(200)),
    description: text(10000).default(''),
    status: z.enum(['todo', 'in-progress', 'completed', 'on-hold']).default('todo'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    category: z.string().trim().min(1).max(80).default('General'),
    dueDate: isoDateSchema.nullable().default(null),
    createdAt: z.string().max(50).optional(),
    updatedAt: z.string().max(50).optional(),
    createdBy: uuidSchema.optional(),
    assignedTo: uuidSchema.nullable().optional(),
    subtasks: z.array(subtaskSchema).max(100).default([]),
    followUps: z.array(followUpSchema).max(100).default([]),
  })
  .strict()

export function uniqueNestedIds(items: { id?: string }[]): boolean {
  const ids = items.flatMap((item) => (item.id ? [item.id] : []))
  return new Set(ids).size === ids.length
}
