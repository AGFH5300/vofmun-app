
import React, { useEffect } from 'react'
import { Update } from '@/db/types'
import { ProtectedRoute } from '@/components/protectedroute'
import { useMobile } from '@/hooks/use-mobile'
import { motion } from 'framer-motion'
import { Bell, Clock, AlertTriangle } from 'lucide-react'
import supabase from '@/lib/supabase'

const Page = () => {
    const [isLoading, setIsLoading] = React.useState<boolean>(true);
    const [updates, setUpdates] = React.useState<Update[]>([]);
    const isMobile = useMobile();
    
    useEffect( () => {
        const fetchUpdates = async () => {
            try {
                setIsLoading(true);
                const { data, error } = await supabase
                    .from('Updates')
                    .select('*')
                    .order('time', { ascending: false });

                if (error) {
                    console.error("Failed to fetch updates:", error);
                    return;
                }

                if (data) {
                    data.forEach((update: Update) => {
                        if (update.href) {
                            console.log(`Update ${update.updateID} has image URL: ${update.href}`);
                        } else {
                            console.warn(`Update ${update.updateID} has no image URL`);
                        }
                    });

                    setUpdates(data);
                }
            } catch (error) {
                console.error("Error fetching updates:", error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchUpdates();
    },[]);

  return (
    <ProtectedRoute>
        <div className="page-shell">
            <div className="page-maxwidth space-y-12">
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7 }}
                    className="surface-card is-emphasised overflow-hidden"
                >
                    <div className="relative px-8 py-12 md:px-12">
                        <div className="flex flex-col items-center text-center gap-6">
                            <span className="badge-pill bg-white/15 text-white/80">
                                <Bell size={18} /> Real-time feed
                            </span>
                            <h1 className="text-4xl md:text-5xl font-serif font-bold text-white leading-tight">
                                Live Crisis Updates
                            </h1>
                            <p className="text-base md:text-lg text-white/85 max-w-3xl leading-relaxed">
                                Track urgent developments, directives, and crisis intelligence in real time. Respond swiftly to keep your delegation informed and prepared.
                            </p>
                        </div>
                        <div className="absolute inset-x-0 -bottom-32 h-64 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
                    </div>
                </motion.section>

                <section>
                    {isLoading ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="surface-card flex flex-col items-center justify-center py-16"
                        >
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-deep-red to-dark-burgundy mb-6">
                                <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
                            </div>
                            <p className="text-lg text-almost-black-green/75">Fetching the latest intelligence...</p>
                        </motion.div>
                    ) : (
                        <div className="space-y-8">
                            {updates.length > 0 ? (
                                updates.map((update, index) => (
                                    <motion.article
                                        key={update.updateID}
                                        initial={{ opacity: 0, y: 18 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.55, delay: index * 0.1 }}
                                        className="surface-card overflow-hidden"
                                    >
                                        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                                            <div className="p-7 md:p-9">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <span className="inline-flex items-center gap-2 rounded-full bg-soft-rose/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-deep-red">
                                                        <AlertTriangle size={16} /> Crisis Alert
                                                    </span>
                                                    <span className="text-sm text-almost-black-green/60 flex items-center gap-2">
                                                        <Clock size={16} />
                                                        {new Date(update.time).toLocaleString()}
                                                    </span>
                                                </div>
                                                <h2 className="text-2xl md:text-3xl font-serif font-semibold text-deep-red mb-4">
                                                    {update.title}
                                                </h2>
                                                <p className="text-almost-black-green/80 leading-relaxed text-base md:text-lg">
                                                    {update.content}
                                                </p>

                                                <div className="mt-6 rounded-xl border border-rich-gold/30 bg-soft-ivory/80 p-4">
                                                    <div className="flex items-start gap-3">
                                                        <AlertTriangle className="h-5 w-5 text-rich-gold mt-0.5" />
                                                        <p className="text-sm text-almost-black-green/80">
                                                            <strong className="text-deep-red">Immediate Action Required:</strong> Respond within the next session. Coordinate with your bloc to craft directives and notify the dais once complete.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="relative">
                                                {update.href ? (
                                                    <div className="h-full min-h-[240px]">
                                                        <img
                                                            src={update.href}
                                                            alt={`Update ${update.updateID} illustration`}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="h-full min-h-[240px] bg-gradient-to-br from-soft-ivory via-primary-peach to-soft-rose flex items-center justify-center">
                                                        <div className="text-center p-6 text-almost-black-green/70">
                                                            <AlertTriangle size={40} className="mx-auto mb-4 text-deep-red/60" />
                                                            <p className="text-sm uppercase tracking-[0.3em]">Awaiting imagery</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.article>
                                ))
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="surface-card text-center py-16 px-6"
                                >
                                    <div className="w-20 h-20 bg-soft-ivory rounded-full flex items-center justify-center mx-auto mb-6 border border-soft-rose">
                                        <Bell size={32} className="text-deep-red" />
                                    </div>
                                    <h3 className="text-2xl font-serif font-semibold text-deep-red mb-3">All Clear for Now</h3>
                                    <p className="text-almost-black-green/75 max-w-2xl mx-auto leading-relaxed">
                                        The conference is currently stable. Check back frequently—urgent alerts will appear here with actionable guidance the moment situations escalate.
                                    </p>
                                </motion.div>
                            )}
                        </div>
                    )}
                </section>
            </div>
        </div>
    </ProtectedRoute>
  )
}

export default Page;
