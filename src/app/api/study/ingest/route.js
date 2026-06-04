import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { detectIngestType, ingestWiki, ingestPaste, ingestAiGen, ingestUrl } from '@/lib/study/ingest'
import { tamperPlainText } from '@/lib/study/tamper'

export async function POST(request) {
  const session = await auth()

  const contentType = request.headers.get('content-type') ?? ''
  let input = {}

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    input = {
      text:       form.get('text')       ?? '',
      grade:      form.get('grade')      ?? '',
      subject:    form.get('subject')    ?? '',
      difficulty: form.get('difficulty') ?? 'medium',
      packId:     form.get('packId')     ?? null,
      isPrivate:  form.get('isPrivate')  === 'true',
      title:      form.get('title')      ?? '',
    }
    const file = form.get('file')
    if (file) input.file = { buffer: Buffer.from(await file.arrayBuffer()), mime: file.type, name: file.name }
  } else {
    input = await request.json()
  }

  // Library pick: just create the junction row, no new article needed
  if (input.articleId) {
    if (input.packId) {
      const max = await prisma.studyPackArticle.aggregate({
        where: { packId: input.packId }, _max: { order: true },
      })
      await prisma.studyPackArticle.create({
        data: { packId: input.packId, articleId: input.articleId, order: (max._max.order ?? 0) + 1 },
      })
    }
    return Response.json({ type: 'existing', articleId: input.articleId })
  }

  let plainText, title
  const type = detectIngestType(input)

  switch (type) {
    case 'wiki':
      ;({ text: plainText, title } = await ingestWiki(input.text))
      break
    case 'paste':
      ;({ text: plainText, title } = ingestPaste(input.text))
      break
    case 'ai-gen':
      ;({ text: plainText, title } = await ingestAiGen(input.text, input.grade, input.subject))
      break
    case 'url':
      ;({ text: plainText, title } = await ingestUrl(input.text))
      break
    case 'file': {
      // PDF or DOCX extraction
      let rawText = ''
      if (input.file.mime === 'application/pdf' || input.file.name?.endsWith('.pdf')) {
        const pdfParse = (await import('pdf-parse')).default
        const result = await pdfParse(input.file.buffer)
        rawText = result.text
      } else {
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ buffer: input.file.buffer })
        rawText = result.value
      }
      plainText = rawText.replace(/\s+/g, ' ').trim()
      title = input.file.name?.replace(/\.[^.]+$/, '') ?? 'Uploaded document'
      break
    }
    default:
      return Response.json({ error: 'Unknown input type' }, { status: 400 })
  }

  if (!plainText || plainText.length < 80) {
    return Response.json({ error: 'Extracted text too short' }, { status: 422 })
  }

  // Run through tamper engine
  const { tampered, mistakes, decoys } = await tamperPlainText(plainText, {
    difficulty: input.difficulty ?? 'medium',
  })

  const isPrivate = input.isPrivate || !session  // unauthenticated = always private
  const article = await prisma.factCheckArticle.create({
    data: {
      title:         input.title || title,
      subject:       input.subject || 'general',
      category:      input.subject || 'general',
      difficulty:    input.difficulty ?? 'medium',
      tampered,
      mistakes,
      decoys,
      grade:         input.grade  || null,
      curriculum:    input.curriculum || null,
      generatedFrom: type,
      sourceFile:    type === 'file' ? (input.file.name ?? null) : null,
      sourceUrl:     type === 'wiki' ? input.text : null,
      status:        isPrivate ? 'approved' : 'pending',
    },
  })

  if (input.packId) {
    const max = await prisma.studyPackArticle.aggregate({
      where: { packId: input.packId }, _max: { order: true },
    })
    await prisma.studyPackArticle.create({
      data: { packId: input.packId, articleId: article.id, order: (max._max.order ?? 0) + 1 },
    })
  }

  return Response.json({
    type,
    articleId: article.id,
    title:     article.title,
    status:    article.status,
  })
}
