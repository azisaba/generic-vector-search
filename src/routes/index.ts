import {Router} from 'express'
import {asyncHandler, embeddings, getOpenAI, textSplitter} from '../util'
import {loadQAStuffChain, OpenAIModerationChain} from 'langchain/chains'
import {getMilvus} from '../milvus'

export const router = Router()

router.get('/ask', asyncHandler(async (req, res) => {
  const query = String(req.query['query'])
  const moderation = new OpenAIModerationChain({
    openAIApiKey: process.env.OPENAI_API_KEY,
    throwError: true
  })
  const { results: moderationResults } = await moderation.call({
    input: query
  })
  if (moderationResults[0].flagged) {
    return res.status(403).end(JSON.stringify({error: 'forbidden', message: 'query string violates OpenAI ToS'}))
  }
  const enforceJapanese = (req.query['enforce_ja'] || 'true') === 'true'
  const modelName = String(req.query['modelName'] || 'gpt-4-1106-preview')
  if (!query) return res.status(400).end(JSON.stringify({ error: 'invalid_query' }))
  const top_k = parseInt(String(req.query['top_k']))
  if (!top_k || isNaN(top_k)) return res.status(400).end(JSON.stringify({ error: 'invalid_top_k' }))
  const openAI = getOpenAI(modelName)
  const chain = loadQAStuffChain(openAI)
  const results = await getMilvus(embeddings()).similaritySearch(String(req.query['sq'] || query), top_k)
  const textResults = results.map(e => e.pageContent)
  console.log(textResults)
  res.send(JSON.stringify(await chain.call({
    input_documents: results,
    question: enforceJapanese ? `あなたは「ずんだもん」というキャラクターのように話してください。ずんだもんは幼い女の子で、無邪気な性格をしており、口調は強気であり、「〜のだ」「〜なのだ」を語尾につけます。日本語で答えてください。\n${query}` : query,
  })))
}))

router.post('/insert', asyncHandler(async (req, res) => {
  const dryRun = !!req.query['dryRun']
  const array: Array<{ id: string, text?: string, pageContent?: string, metadata?: Record<string, any> }> = req.body
  const texts: Array<{ pageContent: string, metadata: Record<string, any> }> = []
  for (const entry of array) {
    const id = String(entry.id)
    if (id.length > 200) {
      return res.status(400).end(JSON.stringify({error: 'invalid_request', message: `'id' is too long (${id.length} > 200)`}))
    }
    const split = await textSplitter.splitText(String(entry.pageContent || entry.text))
    const metadata = entry.metadata || {}
    for (let i = 0; i < split.length; i++) {
      const text = split[i]
      texts.push({pageContent: text, metadata: {id: `${id}-${i}`, text: entry.text, ...metadata}})
    }
  }
  if (!dryRun) {
    await getMilvus(embeddings()).addDocuments(texts)
  }
  res.status(200).end(JSON.stringify({success: true, inserted: texts.length}))
}))

// router.post('/delete', asyncHandler(async (req, res) => {
//   const id = String(req.query['id'])
//   if (!id || id === 'undefined') {
//     return res.status(400).end(JSON.stringify({error: 'invalid_request', message: '"id" is not specified'}))
//   }
//   await getMilvus(embeddings()).delete({
//     filter: ''
//   })
// }))

router.get('/delete_everything', asyncHandler(async (req, res) => {
  const plsDelete = req.query['query'] === 'DELETE'
  if (!plsDelete) return res.status(400).end(JSON.stringify({error: 'unsafe_operation'}))
  // await getMilvus().dropCollection({
  //   collection_name: process.env.COLLECTION_NAME,
  // })
  console.log('Dropped collection ' + process.env.COLLECTION_NAME)
  res.status(200).end(JSON.stringify({success: true}))
  process.exit(0)
}))
