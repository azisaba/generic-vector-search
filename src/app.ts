import * as express from 'express'
import {router as indexRouter} from './routes/'
import {config} from 'dotenv'
import {getMilvus} from './milvus'
import {ErrorRequestHandler} from 'express'
import {embeddings} from './util'

config()

const app = express()

app.use(express.json({
  limit: '1000gb',
}))
app.use(express.urlencoded({ extended: false }))

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
