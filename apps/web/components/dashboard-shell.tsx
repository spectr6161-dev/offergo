"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";

type NavigationItem = {
  href: string;
  label: string;
};

export function DashboardShell({
  title,
  subtitle,
  items,
  children,
}: {
  title: string;
  subtitle: string;
  items: NavigationItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", gridTemplateColumns: { xs: "1fr", md: "280px minmax(0, 1fr)" } }}>
      <Box
        component="aside"
        sx={{
          borderRight: { md: "1px solid" },
          borderColor: { md: "divider" },
          backgroundColor: "background.paper",
          p: 3,
        }}
      >
        <Stack spacing={3}>
          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <Avatar sx={{ bgcolor: "primary.main" }}>O</Avatar>
            <Box>
              <Typography variant="h6">offerGO</Typography>
              <Typography variant="body2" color="text.secondary">
                {title}
              </Typography>
            </Box>
          </Stack>
          <Divider />
          <List disablePadding>
            {items.map((item) => (
              <Link key={item.href} href={item.href} style={{ color: "inherit", textDecoration: "none" }}>
                <ListItemButton selected={pathname === item.href || pathname.startsWith(`${item.href}/`)}>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </Link>
            ))}
          </List>
          <Divider />
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        </Stack>
      </Box>
      <Box component="section">
        <AppBar position="sticky" color="transparent" elevation={0} sx={{ backdropFilter: "blur(10px)", borderBottom: "1px solid", borderColor: "divider" }}>
          <Toolbar>
            <Typography variant="h6">{title}</Typography>
          </Toolbar>
        </AppBar>
        <Box sx={{ p: { xs: 2, md: 4 } }}>{children}</Box>
      </Box>
    </Box>
  );
}
