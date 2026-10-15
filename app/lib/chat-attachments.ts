export const CHAT_ATTACHMENT_POLICY = {
  maxFiles: 5,
  maxFileBytes: 10 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
  maxRequestBytes: 21 * 1024 * 1024,
  formats: {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    zip: 'application/zip',
  },
} as const

export const CHAT_ATTACHMENT_ACCEPT = Object.keys(CHAT_ATTACHMENT_POLICY.formats).map((extension) => `.${extension}`).join(',')
