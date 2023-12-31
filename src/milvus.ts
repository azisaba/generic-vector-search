import {Milvus} from 'langchain/vectorstores/milvus'
import {OpenAIEmbeddings} from 'langchain/embeddings/openai'
import {DataType, MilvusClient} from '@zilliz/milvus2-sdk-node'
import {embeddings} from './util'
import {Document} from 'langchain/document'

let milvus: Milvus

export const getMilvus = (embeddings: OpenAIEmbeddings) => {
  if (!milvus) {
    milvus = new Milvus(embeddings, {
      clientConfig: {
        address: process.env.MILVUS_ADDRESS,
        username: process.env.MILVUS_USERNAME || undefined,
        password: process.env.MILVUS_PASSWORD || undefined,
        ssl: process.env.MILVUS_SSL === 'true',
      },
      textFieldMaxLength: 10000,
      collectionName: process.env.COLLECTION_NAME,
      textField: 'langchain_text',
      primaryField: 'langchain_primaryid',
      vectorField: 'langchain_vector',
    })
    if (process.env.DELETE_MILVUS_COLLECTION === 'true') {
      milvus.client.dropCollection({collection_name: process.env.COLLECTION_NAME})
        .then(e => console.log('Dropped collection ' + process.env.COLLECTION_NAME, e))
    }
    milvus.indexCreateParams = {
      index_type: process.env.INDEX_TYPE,
      metric_type: process.env.METRIC_TYPE,
      params: process.env.INDEX_PARAMS,
    }
  }
  return milvus
}

export const createCollection = async (documents: Document[]) => {
  const fields = Object.keys(documents[0].metadata).map(name => {
    const type = typeof documents[0].metadata[name]
    if (type === 'string') {
      return {
        name,
        description: `Metadata String field`,
        data_type: DataType.VarChar,
        type_params: {
          max_length: '10000',
        },
      }
    } else if (type === 'number') {
      return {
        name,
        description: `Metadata Number field`,
        data_type: DataType.Float,
      }
    } else if (type === "boolean") {
      return {
        name,
        description: `Metadata Boolean field`,
        data_type: DataType.Bool,
      }
    } else if (documents[0].metadata[name] === null) {
      // skip
    } else {
      return {
        name,
        description: `Metadata JSON field`,
        data_type: DataType.VarChar,
        type_params: {
          max_length: '10000',
        },
      }
    }
  })
  const milvus = getMilvus(embeddings()).client
  const result = await milvus.hasCollection({
    collection_name: process.env.COLLECTION_NAME,
  })
  if (result.value) return
  await milvus.createCollection({
    collection_name: process.env.COLLECTION_NAME,
    primary_field_name: 'langchain_primaryid',
    fields: [
      {
        name: 'langchain_primaryid',
        description: 'Primary key',
        data_type: DataType.Int64,
        is_primary_key: true,
        autoID: true,
      },
      {
        name: 'langchain_text',
        description: 'Text field',
        data_type: DataType.VarChar,
        type_params: {
          max_length: '10000'
        },
      },
      {
        name: 'langchain_vector',
        description: 'Vector field',
        data_type: DataType.FloatVector,
        type_params: {
          dim: process.env.COLLECTION_DIMENSIONS,
        },
      },
      ...fields,
    ]
  }).then(res => {
    if (process.env.DELETE_MILVUS_COLLECTION === 'true') console.log('createCollection result', res)
  })
  await milvus.createIndex({
    collection_name: process.env.COLLECTION_NAME,
    field_name: 'langchain_vector',
    extra_params: {
      index_type: process.env.INDEX_TYPE,
      metric_type: process.env.METRIC_TYPE,
      params: process.env.INDEX_PARAMS,
    }
  }).then(res => {
    if (process.env.DELETE_MILVUS_COLLECTION === 'true') console.log('createIndex result', res)
  })
}
