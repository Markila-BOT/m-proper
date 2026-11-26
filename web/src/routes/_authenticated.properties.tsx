import { createFileRoute } from '@tanstack/react-router'
import PropertiesList from '../components/PropertiesList'

export const Route = createFileRoute('/_authenticated/properties')({
  component: PropertiesView,
})

function PropertiesView() {
  return <PropertiesList />
}
