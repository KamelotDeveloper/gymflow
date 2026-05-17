import AdminLayout from '../../shared/components/AdminLayout'

export default function Dashboard() {
  return (
    <AdminLayout pageTitle="Dashboard">
      <p style={{ color: '#6b7280', fontSize: 14 }}>
        Bienvenido al panel de administración.
      </p>
    </AdminLayout>
  )
}
