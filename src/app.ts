import * as express from 'express'
import {router as indexRouter} from './routes/'
import {config} from 'dotenv'
import {getMilvus} from './milvus'
import {ErrorRequestHandler} from 'express'
import {asyncHandler, embeddings} from './util'

config()

const app = express()

app.use(express.json({
  limit: '1000gb',
}))
app.use(express.urlencoded({ extended: false }))

app.get('/query', asyncHandler(async (req, res) => {
  if (process.env.PROTECT_QUERY === 'true' && process.env.SECRET && req.header('Authorization') !== process.env.SECRET) {
    return res.status(403).end(JSON.stringify({ error: 'invalid_secret' }))
  }
  const query = String(req.query['query'])
  if (!query || query === 'undefined' || query.length > 200) return res.status(400).end(JSON.stringify({ error: 'invalid_query' }))
  const top_k = parseInt(String(req.query['top_k']))
  if (!top_k || isNaN(top_k)) return res.status(400).end(JSON.stringify({ error: 'invalid_top_k' }))
  console.log('query', query)
  const filter = String(req.query['filter'] || '') || undefined
  const results = await getMilvus(embeddings()).similaritySearchWithScore(query, top_k, filter)
  console.log('results', results)
  res.setHeader('Access-Control-Allow-Origin', '*')
    .send(JSON.stringify({ results: results.map(([doc, score]) => ({score, ...doc})) }))
}))

app.use((req, res, next) => {
  if (process.env.SECRET && req.header('Authorization') !== process.env.SECRET) {
    return res.status(403).end(JSON.stringify({ error: 'invalid_secret' }))
  }
  next()
})

app.use('/', indexRouter)

app.use(((err, _req, res, _next) => {
  console.log(err.stack || err)
  res.status(500).end(JSON.stringify({ error: 'internal_error' }))
}) as ErrorRequestHandler)

;(async () => {
  getMilvus(embeddings())
  app.listen(process.env.PORT || 8080, () => console.log('Listening @ ' + (process.env.PORT || 8080)))
})()
