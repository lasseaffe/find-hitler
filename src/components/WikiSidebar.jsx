// Static Wikipedia-style left nav. All links are no-ops during gameplay.
export default function WikiSidebar({ className = '' }) {
  return (
    <aside
      className={className}
      style={{
        width: 150,
        flexShrink: 0,
        borderRight: '1px solid #a2a9b1',
        background: '#fff',
        fontFamily: 'sans-serif',
        fontSize: 10,
        padding: '10px 8px',
        alignSelf: 'stretch',
      }}
    >
      <SidebarSection title="Navigation">
        <SidebarLink>Main page</SidebarLink>
        <SidebarLink>Random article</SidebarLink>
        <SidebarLink>Contents</SidebarLink>
        <SidebarLink>Current events</SidebarLink>
      </SidebarSection>

      <SidebarSection title="Contribute">
        <SidebarLink>Help</SidebarLink>
        <SidebarLink>Learn to edit</SidebarLink>
        <SidebarLink>About Wikipedia</SidebarLink>
        <SidebarLink>Community portal</SidebarLink>
      </SidebarSection>

      <SidebarSection title="Languages">
        <SidebarLink>Deutsch</SidebarLink>
        <SidebarLink>Français</SidebarLink>
        <SidebarLink>Español</SidebarLink>
        <SidebarLink>日本語</SidebarLink>
        <SidebarLink>中文</SidebarLink>
      </SidebarSection>
    </aside>
  )
}

function SidebarSection({ title, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 9,
        fontWeight: 700,
        color: '#555',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        borderBottom: '1px solid #a2a9b1',
        paddingBottom: 3,
        marginBottom: 5,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function SidebarLink({ children }) {
  return (
    <a
      href="#"
      onClick={e => e.preventDefault()}
      style={{
        display: 'block',
        color: '#3366cc',
        textDecoration: 'none',
        marginBottom: 3,
        fontSize: 10,
      }}
    >
      {children}
    </a>
  )
}
