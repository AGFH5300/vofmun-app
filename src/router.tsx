import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type NavigationGuard = (to: string) => boolean;

interface RouterContextValue {
  pathname: string;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  registerNavigationGuard: (guard: NavigationGuard) => () => void;
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
  const guardsRef = React.useRef<Set<NavigationGuard>>(new Set());
  const pathnameRef = React.useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const registerNavigationGuard = React.useCallback((guard: NavigationGuard) => {
    guardsRef.current.add(guard);
    return () => {
      guardsRef.current.delete(guard);
    };
  }, []);

  const canNavigate = React.useCallback(
    (target: string) => {
      for (const guard of Array.from(guardsRef.current)) {
        if (!guard(target)) {
          return false;
        }
      }
      return true;
    },
    []
  );

  useEffect(() => {
    const handlePopState = () => {
      const target = normalizePath(window.location.pathname);
      if (!canNavigate(target)) {
        window.history.pushState({}, '', pathnameRef.current);
        return;
      }
      setPathname(target);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [canNavigate]);

  const navigate = React.useCallback(
    (to: string, options?: { replace?: boolean }) => {
      const target = normalizePath(to);
      if (!canNavigate(target)) {
        return;
      }

      if (options?.replace) {
        window.history.replaceState({}, '', target);
      } else {
        window.history.pushState({}, '', target);
      }
      pathnameRef.current = target;
      setPathname(target);
    },
    [canNavigate]
  );

  const value = useMemo<RouterContextValue>(
    () => ({ pathname, navigate, registerNavigationGuard }),
    [pathname, navigate, registerNavigationGuard]
  );

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
