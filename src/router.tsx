import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

interface RouterContextValue {
  pathname: string;
  navigate: (to: string, options?: { replace?: boolean }) => void;
}

const RouterContext = createContext<RouterContextValue | undefined>(undefined);

const normalizePath = (path: string) => {
  if (!path.startsWith('/')) {
    return `/${path}`;
  }
  return path.replace(/\/+$/, '') || '/';
};

export const RouterProvider = ({ children }: { children: React.ReactNode }) => {
  const [pathname, setPathname] = useState(() => normalizePath(window.location.pathname));

  useEffect(() => {
    const handlePopState = () => {
      setPathname(normalizePath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (to: string, options?: { replace?: boolean }) => {
    const target = normalizePath(to);
    if (options?.replace) {
      window.history.replaceState({}, '', target);
    } else {
      window.history.pushState({}, '', target);
    }
    setPathname(target);
  };

  const value = useMemo<RouterContextValue>(() => ({ pathname, navigate }), [pathname]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
};

export const useRouter = () => {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
};

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
}

export const Link: React.FC<React.PropsWithChildren<LinkProps>> = ({ to, onClick, ...props }) => {
  const { navigate } = useRouter();

  const handleClick: React.MouseEventHandler<HTMLAnchorElement> = (event) => {
    if (onClick) {
      onClick(event);
    }

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }

    event.preventDefault();
    navigate(to);
  };

  return <a href={to} onClick={handleClick} {...props} />;
};

export const Navigate = ({ to, replace = false }: { to: string; replace?: boolean }) => {
  const { navigate, pathname } = useRouter();

  useEffect(() => {
    if (normalizePath(pathname) !== normalizePath(to)) {
      navigate(to, { replace });
    }
  }, [navigate, to, replace, pathname]);

  return null;
};
