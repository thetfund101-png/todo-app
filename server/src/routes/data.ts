import { Router, Request, Response, NextFunction } from 'express'
import multer, { MulterError } from 'multer'
import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType } from 'docx'
import { z } from 'zod'
import { HttpError, asyncRoute } from '../errors.js'
import { requireAuth } from '../middleware/auth.js'
import { validateQuery } from '../middleware/validate.js'
import { legacyImportTaskSchema, TaskInput } from '../schemas.js'
import { writeAuditLog } from '../services/audit.js'
import { createTasksBatch, listTasks, TaskDto } from '../services/tasks.js'

const router = Router()
router.use(requireAuth)
const importSchema = z.array(legacyImportTaskSchema).max(500)
const exportQuery = z.object({ format: z.enum(['json', 'csv', 'docx']) }).strict()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024, files: 1, fields: 0, parts: 1 },
  fileFilter: (_request, file, callback) => {
    if (file.mimetype !== 'application/json') {
      callback(new HttpError(415, 'UNSUPPORTED_FILE_TYPE', 'Upload a JSON file with application/json MIME type.'))
      return
    }
    callback(null, true)
  },
})

function importUpload(request: Request, response: Response, next: NextFunction) {
  upload.single('file')(request, response, (error: unknown) => {
    if (!error) {
      next()
      return
    }
    if (error instanceof MulterError && error.code === 'LIMIT_FILE_SIZE') {
      next(new HttpError(413, 'IMPORT_TOO_LARGE', 'Import file must be 1 MB or smaller.'))
      return
    }
    if (error instanceof HttpError) {
      next(error)
      return
    }
    next(new HttpError(400, 'INVALID_UPLOAD', 'The JSON file could not be uploaded.'))
  })
}

async function visibleTasks(user: NonNullable<Request['user']>): Promise<TaskDto[]> {
  const tasks: TaskDto[] = []
  let page = 1
  let total = 0
  do {
    const result = await listTasks({ page, pageSize: 100, sort: 'newest' }, user)
    tasks.push(...result.tasks)
    total = result.total
    page += 1
  } while (tasks.length < total)
  return tasks
}

function safeCsvCell(value: unknown): string {
  let text = String(value ?? '')
  if (/^[\s\uFEFF]*[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

function csv(tasks: TaskDto[]): string {
  const columns = ['title', 'description', 'status', 'priority', 'category', 'dueDate', 'subtasks', 'followUps']
  const rows = tasks.map((task) =>
    [
      task.title,
      task.description,
      task.status,
      task.priority,
      task.category,
      task.dueDate ?? '',
      task.subtasks.map((item) => `${item.done ? '[x]' : '[ ]'} ${item.title}`).join('; '),
      task.followUps
        .map((item) => `${item.completed ? '[x]' : '[ ]'} ${item.date}${item.note ? ` - ${item.note}` : ''}`)
        .join('; '),
    ]
      .map(safeCsvCell)
      .join(','),
  )
  return [columns.map(safeCsvCell).join(','), ...rows].join('\r\n')
}

function wordTable(tasks: TaskDto[]) {
  const columns = ['Task', 'Description', 'Status', 'Priority', 'Category', 'Due date', 'Follow-ups']
  const rows = [
    new TableRow({
      tableHeader: true,
      children: columns.map((column) => new TableCell({ children: [new Paragraph(column)] })),
    }),
    ...tasks.map(
      (task) =>
        new TableRow({
          children: [
            task.title,
            task.description,
            task.status,
            task.priority,
            task.category,
            task.dueDate ?? 'None',
            task.followUps.length
              ? task.followUps
                  .map(
                    (item) =>
                      `${item.completed ? '[Completed] ' : ''}${item.date}${item.note ? ` - ${item.note}` : ''}`,
                  )
                  .join('\n')
              : 'None',
          ].map((text) => new TableCell({ children: [new Paragraph(text)] })),
        }),
    ),
  ]
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } })
}

router.get(
  '/tasks',
  validateQuery(exportQuery),
  asyncRoute(async (request, response) => {
    const tasks = await visibleTasks(request.user!)
    const format = request.query.format
    if (format === 'json') {
      await writeAuditLog({
        userId: request.user!.id,
        action: 'tasks_exported_json',
        entityType: 'task',
        ip: request.socket.remoteAddress ?? '',
        metadata: { count: tasks.length },
      })
      response.setHeader('Content-Type', 'application/json; charset=utf-8')
      response.setHeader(
        'Content-Disposition',
        `attachment; filename="thet-fund-tasks-${new Date().toISOString().slice(0, 10)}.json"`,
      )
      response.json(tasks)
      return
    }
    if (format === 'csv') {
      await writeAuditLog({
        userId: request.user!.id,
        action: 'tasks_exported_csv',
        entityType: 'task',
        ip: request.socket.remoteAddress ?? '',
        metadata: { count: tasks.length },
      })
      response.setHeader('Content-Type', 'text/csv; charset=utf-8')
      response.setHeader(
        'Content-Disposition',
        `attachment; filename="thet-fund-tasks-${new Date().toISOString().slice(0, 10)}.csv"`,
      )
      response.send(csv(tasks))
      return
    }
    if (format === 'docx') {
      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({ text: 'THET Fund Task Tracker', heading: 'Heading1' }),
              new Paragraph(`Exported ${new Date().toLocaleDateString()}`),
              wordTable(tasks),
            ],
          },
        ],
      })
      const buffer = await Packer.toBuffer(doc)
      await writeAuditLog({
        userId: request.user!.id,
        action: 'tasks_exported_docx',
        entityType: 'task',
        ip: request.socket.remoteAddress ?? '',
        metadata: { count: tasks.length },
      })
      response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      response.setHeader(
        'Content-Disposition',
        `attachment; filename="thet-fund-tasks-${new Date().toISOString().slice(0, 10)}.docx"`,
      )
      response.send(buffer)
      return
    }
    throw new HttpError(400, 'INVALID_EXPORT_FORMAT', 'format must be json, csv, or docx.')
  }),
)

router.post(
  '/tasks/import',
  importUpload,
  asyncRoute(async (request, response) => {
    if (!request.file) throw new HttpError(400, 'IMPORT_FILE_REQUIRED', 'Select a JSON file to import.')
    let data: unknown
    try {
      data = JSON.parse(request.file.buffer.toString('utf8'))
    } catch {
      throw new HttpError(400, 'INVALID_JSON', 'The uploaded file is not valid JSON.')
    }
    const parsed = importSchema.safeParse(data)
    if (!parsed.success) {
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        'The JSON file does not match the task export format.',
        parsed.error.flatten(),
      )
    }
    const inputs: TaskInput[] = parsed.data.map((task) => ({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      category: task.category,
      dueDate: task.dueDate,
      assignedTo: task.assignedTo,
      subtasks: task.subtasks,
      followUps: task.followUps,
    }))
    const tasks = await createTasksBatch(inputs, request.user!)
    await writeAuditLog({
      userId: request.user!.id,
      action: 'tasks_imported',
      entityType: 'task',
      ip: request.socket.remoteAddress ?? '',
      metadata: { count: tasks.length },
    })
    response.status(201).json({ data: { imported: tasks.length, tasks } })
  }),
)

export default router
