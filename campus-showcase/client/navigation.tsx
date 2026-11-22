import React from 'react';

export default function Link({href,children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} href={href}>{children}</a>;
}

const router = {
  replace(path:string) { window.location.replace(path); },
  push(path:string) { window.location.assign(path); },
  refresh() { /* A full page navigation fetches the next server session. */ }
};
export const useRouter = () => router;
export const useSearchParams = () => new URLSearchParams(window.location.search);
