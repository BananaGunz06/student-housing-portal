import { Link, useParams } from 'react-router-dom'
import ListingDetailContent from '../components/ListingDetailContent'
import { getById } from '../lib/listingsRepo'
import NotFound from './NotFound'

export default function ListingDetail() {
  const { id = '' } = useParams()
  const listing = getById(id)
  if (!listing) {
    return <NotFound title="We couldn’t find that place" body="It may have been taken off the list." />
  }

  return (
    <article className="mx-auto max-w-3xl pb-24">
      <div className="px-4 py-3">
        <Link to="/results" className="inline-flex min-h-11 items-center font-bold underline">
          Back to results
        </Link>
      </div>
      <ListingDetailContent listing={listing} variant="page" />
    </article>
  )
}
