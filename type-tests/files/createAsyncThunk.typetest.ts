import { createAsyncThunk, Dispatch, createReducer, AnyAction } from 'src'
import { ThunkDispatch } from 'redux-thunk'
import { unwrapResult, SerializedError } from 'src/createAsyncThunk'

import apiRequest, { AxiosError } from 'axios'
import { IsAny } from 'src/tsHelpers'

function expectType<T>(t: T) {
  return t
}
const defaultDispatch = (() => {}) as ThunkDispatch<{}, any, AnyAction>

  // basic usage
;(async function() {
  const async = createAsyncThunk('test', (id: number) =>
    Promise.resolve(id * 2)
  )

  const reducer = createReducer({}, builder =>
    builder
      .addCase(async.pending, (_, action) => {
        expectType<ReturnType<typeof async['pending']>>(action)
      })
      .addCase(async.fulfilled, (_, action) => {
        expectType<ReturnType<typeof async['fulfilled']>>(action)
        expectType<number>(action.payload)
      })
      .addCase(async.rejected, (_, action) => {
        expectType<ReturnType<typeof async['rejected']>>(action)
        expectType<Partial<Error> | undefined>(action.error)
      })
  )

  const promise = defaultDispatch(async(3))
  const result = await promise

  if (async.fulfilled.match(result)) {
    expectType<ReturnType<typeof async['fulfilled']>>(result)
    // typings:expect-error
    expectType<ReturnType<typeof async['rejected']>>(result)
  } else {
    expectType<ReturnType<typeof async['rejected']>>(result)
    // typings:expect-error
    expectType<ReturnType<typeof async['fulfilled']>>(result)
  }

  promise
    .then(unwrapResult)
    .then(result => {
      expectType<number>(result)
      // typings:expect-error
      expectType<Error>(result)
    })
    .catch(error => {
      // catch is always any-typed, nothing we can do here
    })
})()

// More complex usage of thunk args
;(async function() {
  interface BookModel {
    id: string
    title: string
  }

  type BooksState = BookModel[]

  const fakeBooks: BookModel[] = [
    { id: 'b', title: 'Second' },
    { id: 'a', title: 'First' }
  ]

  const correctDispatch = (() => {}) as ThunkDispatch<
    BookModel[],
    { userAPI: Function },
    AnyAction
  >

  // Verify that the the first type args to createAsyncThunk line up right
  const fetchBooksTAC = createAsyncThunk<
    BookModel[],
    number,
    {
      state: BooksState
      extra: { userAPI: Function }
    }
  >(
    'books/fetch',
    async (arg, { getState, dispatch, extra, requestId, signal }) => {
      const state = getState()

      expectType<number>(arg)
      expectType<BookModel[]>(state)
      expectType<{ userAPI: Function }>(extra)
      return fakeBooks
    }
  )

  correctDispatch(fetchBooksTAC(1))
  // typings:expect-error
  defaultDispatch(fetchBooksTAC(1))
})()
/**
 * returning a rejected action from the promise creator is possible
 */
;(async () => {
  type ReturnValue = { data: 'success' }
  type RejectValue = { data: 'error' }

  const fetchBooksTAC = createAsyncThunk<
    ReturnValue,
    number,
    {
      rejectValue: RejectValue
    }
  >('books/fetch', async (arg, { rejectWithValue }) => {
    return rejectWithValue({ data: 'error' })
  })

  const returned = await defaultDispatch(fetchBooksTAC(1))
  if (fetchBooksTAC.rejected.match(returned)) {
    expectType<undefined | RejectValue>(returned.payload)
    expectType<RejectValue>(returned.payload!)
  } else {
    expectType<ReturnValue>(returned.payload)
  }
})()

{
  interface Item {
    name: string
  }

  interface ErrorFromServer {
    error: string
  }

  interface CallsResponse {
    data: Item[]
  }

  const fetchLiveCallsError = createAsyncThunk<
    Item[],
    string,
    {
      rejectValue: ErrorFromServer
    }
  >('calls/fetchLiveCalls', async (organizationId, { rejectWithValue }) => {
    try {
      const result = await apiRequest.get<CallsResponse>(
        `organizations/${organizationId}/calls/live/iwill404`
      )
      return result.data.data
    } catch (err) {
      let error: AxiosError<ErrorFromServer> = err // cast for access to AxiosError properties
      if (!error.response) {
        // let it be handled as any other unknown error
        throw err
      }
      return rejectWithValue(error.response && error.response.data)
    }
  })

  defaultDispatch(fetchLiveCallsError('asd')).then(result => {
    if (fetchLiveCallsError.fulfilled.match(result)) {
      //success
      expectType<ReturnType<typeof fetchLiveCallsError['fulfilled']>>(result)
      expectType<Item[]>(result.payload)
    } else {
      expectType<ReturnType<typeof fetchLiveCallsError['rejected']>>(result)
      if (result.payload) {
        // rejected with value
        expectType<ErrorFromServer>(result.payload)
      } else {
        // rejected by throw
        expectType<undefined>(result.payload)
        expectType<SerializedError>(result.error)
        // typings:expect-error
        expectType<IsAny<typeof result['error'], true, false>>(true)
      }
    }
  })
}
