import { createFileRoute } from '@tanstack/react-router'
import PropertiesList from '../components/PropertiesList'

export const Route = createFileRoute('/properties')({
  component: PropertiesView,
})

function PropertiesView() {
  return <PropertiesList />
}
