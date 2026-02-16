import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'CoE Governance Portal',
    description: 'Power Platform Resource Inventory & Governance',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="ko">
            <head>
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body>{children}</body>
        </html>
    )
}
