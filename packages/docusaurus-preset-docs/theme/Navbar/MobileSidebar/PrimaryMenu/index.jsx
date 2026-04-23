import React from 'react';
import {useThemeConfig} from '@docusaurus/theme-common';
import {useNavbarMobileSidebar} from '@docusaurus/theme-common/internal';
import {useVersions} from '@docusaurus/plugin-content-docs/client';
import NavbarItem from '@theme/NavbarItem';
import DocsVersionDropdownNavbarItem from '@theme/NavbarItem/DocsVersionDropdownNavbarItem';

function hasDocsVersionDropdown(items) {
  return items.some((item) => item.type === 'docsVersionDropdown');
}

function useNavbarItems() {
  return useThemeConfig().navbar.items ?? [];
}

function useReleasedVersionNames() {
  return useVersions()
    .filter((version) => version.name !== 'current')
    .map((version) => version.name);
}

export default function NavbarMobilePrimaryMenu() {
  const mobileSidebar = useNavbarMobileSidebar();
  const items = useNavbarItems();
  const releasedVersionNames = useReleasedVersionNames();
  const shouldRenderDefaultVersionDropdown = !hasDocsVersionDropdown(items);

  return (
    <ul className="menu__list">
      {items.map((item, i) => (
        <NavbarItem
          mobile
          {...item}
          onClick={() => mobileSidebar.toggle()}
          key={i}
        />
      ))}
      {shouldRenderDefaultVersionDropdown && (
        <DocsVersionDropdownNavbarItem
          mobile
          versions={releasedVersionNames}
          dropdownItemsBefore={[]}
          dropdownItemsAfter={[]}
          onClick={() => mobileSidebar.toggle()}
        />
      )}
    </ul>
  );
}
