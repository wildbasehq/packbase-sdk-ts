import {RootProvider} from 'fumadocs-ui/provider/next'
import localFont from 'next/font/local'
import './global.css'

const peanutButterContent = localFont({
    src: './fonts/Peanut-Butter-Content.woff',
})

export default function Layout({children}: LayoutProps<'/'>) {
    return (
        <html lang="en" className={peanutButterContent.className} suppressHydrationWarning>
        <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
        </body>
        </html>
    )
}
