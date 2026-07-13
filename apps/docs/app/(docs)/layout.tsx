import {baseOptions} from '@/lib/layout.shared'
import {source} from '@/lib/source'
import {DocsLayout} from 'fumadocs-ui/layouts/docs'
import {ServerIcon} from 'lucide-react'

export default function Layout({children}: LayoutProps<'/'>) {
    return (
        <DocsLayout tree={source.getPageTree()} {...baseOptions()}
                    tabs={{
                        transform: (option, node) => ({
                            ...option,
                            icon: <ServerIcon className="text-indigo-500 size-5"/>,
                        }),
                    }}
        >
            {children}
        </DocsLayout>
    )
}
