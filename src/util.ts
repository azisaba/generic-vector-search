import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import {NextFunction, Request, Response} from 'express-serve-static-core'
import {RequestHandler} from 'express'
import {OpenAI} from 'langchain/llms/openai'

export const lazy = <T, R extends (T extends Promise<T> ? Promise<T> : T)>(constructor: () => R): () => R => {
  let initialized = false
  let value: R = null
  return () => {
    if (!initialized) {
      value = constructor()
      initialized = true
    }
    return value
  }
}

export const embeddings: () => OpenAIEmbeddings = lazy(() => new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: 'text-embedding-ada-002',
}))

export const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 800,
  chunkOverlap: 120,
})

export const getOpenAI = (modelName: string): OpenAI => new OpenAI({ openAIApiKey: process.env.OPENAI_API_KEY, modelName })

export const asyncHandler = (fn: RequestHandler<any>) => (req: Request<any>, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch(next)
