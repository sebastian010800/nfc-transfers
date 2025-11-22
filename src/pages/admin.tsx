import {
  AppShell,
  Burger,
  Group,
  NavLink,
  ScrollArea,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconUsers, IconPackage, IconCalendarStar } from "@tabler/icons-react";
import { Link, Outlet, useLocation } from "react-router-dom";

export default function AdminLayout() {
  const [opened, { toggle }] = useDisclosure();
  const { pathname } = useLocation();

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 240, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
          <Title order={4}>Panel de Administración</Title>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <ScrollArea style={{ height: "100%" }}>
          <NavLink
            component={Link}
            to="/admin/users"
            label="Usuarios"
            leftSection={<IconUsers size={16} />}
            active={pathname.startsWith("/admin/users")}
            my={4}
          />
          <NavLink
            component={Link}
            to="/admin/products"
            label="Productos"
            leftSection={<IconPackage size={16} />}
            active={pathname.startsWith("/admin/products")}
            my={4}
          />
          <NavLink
            component={Link}
            to="/admin/experiences"
            label="Experiencias"
            leftSection={<IconCalendarStar size={16} />}
            active={pathname.startsWith("/admin/experiences")}
            my={4}
          />
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
