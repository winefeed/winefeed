import { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    absolute: 'Vinkoll Access',
  },
};

export default function ImporterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
