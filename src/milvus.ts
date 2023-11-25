import {Milvus} from 'langchain/vectorstores/milvus'
import {OpenAIEmbeddings} from 'langchain/embeddings/openai'
import {MilvusClient} from '@zilliz/milvus2-sdk-node'

let milvus: Milvus

export const getMilvus = (embeddings: OpenAIEmbeddings) => {
  if (!milvus) {
    if (process.env.DELETE_MILVUS_COLLECTION === 'true') {
      new MilvusClient({
        address: process.env.MILVUS_ADDRESS,
        username: process.env.MILVUS_USERNAME || undefined,
        password: process.env.MILVUS_PASSWORD || undefined,
        ssl: process.env.MILVUS_SSL === 'true',
      }).dropCollection({collection_name: process.env.COLLECTION_NAME}).then(e => console.log('Dropped collection ' + process.env.COLLECTION_NAME, e))
    }
    milvus = new Milvus(embeddings, {
      clientConfig: {
        address: process.env.MILVUS_ADDRESS,
        username: process.env.MILVUS_USERNAME || undefined,
        password: process.env.MILVUS_PASSWORD || undefined,
        ssl: process.env.MILVUS_SSL === 'true',
      },
      textFieldMaxLength: 3000,
      collectionName: process.env.COLLECTION_NAME,
    })
  }
  return milvus
}
