

export interface SiteConfig {
  name: string;
  description: string;
  url: string;
  base: string;
  site: string;
  keywords: Array<string>;
  author: {
    name: string;
    email?: string;
    github?: string;
    avatar?: string;
  };
  navItems: Array<{
    href: string;
    labelKey: string;
    label:string;
  }>;
  socialLinks: Array<{
    nameKey: string;
    href: string;
    icon?: string;
  }>;
  theme: {
    light: {
      primary: string;
      secondary?: string;
    };
    dark: {
      primary: string;
      secondary?: string;
    };
  };
  locale: string;
  giscus?: {
    enabled: boolean;
    repo: string;
    repoId: string;
    category: string;
    categoryId: string;
    mapping: string;
    term?: string;
    strict: string;
    reactionsEnabled: string;
    emitMetadata: string;
    inputPosition: string;
    lang: string;
    loading: 'lazy' | 'eager';
    theme?: { light: string; dark: string };
  };
}

export const siteConfig: SiteConfig = {
  name: "rrzt",
  description: "rrzt 的个人博客：记录技术、学习与日常。",
  url: "https://h465855hgg.github.io/",
  site: "https://h465855hgg.github.io/",
  base: "/",
  keywords: ["rrzt", "blog", "astro", "pudding"],
  author: {
    name: "rrzt",
    github: "https://github.com/h465855hgg",
    avatar: "https://github.com/h465855hgg.png",
  },
  navItems: [
    { href: "./", labelKey: "home", label:"home" },
    { href: "./timeline", labelKey: "timeline", label:"timeline"  },
    { href: "./about", labelKey: "about", label:"about"  },
  ],
  socialLinks: [
    { nameKey: "social.github", href: "https://github.com/h465855hgg" },
    { nameKey: "social.rss", href: "./rss.xml" },
    { nameKey: "social.sitemap", href: "./sitemap.xml" },
  ],
  theme: {
    light: {
      primary: "#5e7eff",
    },
    dark: {
      primary: "#ff9eb6",
    },
  },
  locale: "zh-CN",
  giscus: {
    enabled: false,
    repo: "your-repo/your-repo",
    repoId: "your-repo-id",
    category: "General",
    categoryId: "your-category-id",
    mapping: "pathname",
    strict: "0",
    reactionsEnabled: "1",
    emitMetadata: "0",
    inputPosition: "bottom",
    lang: "en-US",
    loading: "lazy"
  }
};
