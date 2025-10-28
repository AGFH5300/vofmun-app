
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
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
            {/* Hero Section */}
            <div className="bg-gradient-to-r from-[#8B4513] to-[#A0522D] text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="text-center"
                    >
                        <div className="flex justify-center mb-6">
                            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                                <Bell size={40} className="text-white" />
                            </div>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-serif font-bold mb-4">
                            Live Crisis Updates
                        </h1>
                        <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto leading-relaxed">
                            Real-time crisis scenarios that challenge delegates with dynamic diplomatic 
                            situations and urgent response requirements.
                        </p>
                    </motion.div>
                </div>
            </div>

            {/* Updates Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                {isLoading ? (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-16"
                    >
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-[#8B4513] to-[#A0522D] rounded-full mb-6">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
                        </div>
                        <p className="text-xl text-gray-600">Loading updates...</p>
                    </motion.div>
                ) : (
                    <div className="space-y-8">
                        {updates.length > 0 ? (
                            updates.map((update, index) => (
                                <motion.div
                                    key={update.updateID}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, delay: index * 0.1 }}
                                    className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300"
                                >
                                    <div className="flex flex-col lg:flex-row">
                                        {/* Content Side */}
                                        <div className="flex-1 p-8">
                                            <div className="flex items-center mb-4">
                                                <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center mr-4">
                                                    <AlertTriangle size={20} className="text-white" />
                                                </div>
                                                <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium border border-red-200">
                                                    CRISIS ALERT
                                                </span>
                                            </div>
                                            
                                            <h2 className="text-2xl md:text-3xl font-serif font-bold text-gray-900 mb-4">
                                                {update.title}
                                            </h2>
                                            
                                            <div className="flex items-center text-gray-500 mb-4">
                                                <Clock size={16} className="mr-2" />
                                                <span className="text-sm">
                                                    {new Date(update.time.slice(0,10)).toLocaleDateString()} • {new Date(update.time).toLocaleTimeString()}
                                                </span>
                                            </div>
                                            
                                            <p className="text-gray-700 leading-relaxed text-lg">
                                                {update.content}
                                            </p>
                                            
                                            <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
                                                <div className="flex">
                                                    <div className="flex-shrink-0">
                                                        <AlertTriangle className="h-5 w-5 text-yellow-400" />
                                                    </div>
                                                    <div className="ml-3">
                                                        <p className="text-sm text-yellow-700">
                                                            <strong>Immediate Action Required:</strong> Delegates must respond to this crisis within the next session.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Image Side */}
                                        <div className="lg:w-1/3">
                                            {update.href ? (
                                                <div className="h-64 lg:h-full relative">
                                                    <img
                                                        src={update.href}
                                                        alt={`Update ${update.updateID} illustration`}
                                                        className="absolute inset-0 w-full h-full object-cover rounded-2xl shadow-lg"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="h-64 lg:h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                                                    <div className="text-center">
                                                        <AlertTriangle size={48} className="text-gray-400 mx-auto mb-4" />
                                                        <p className="text-gray-500">Crisis Documentation</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-center py-16"
                            >
                                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Bell size={48} className="text-gray-400" />
                                </div>
                                <h3 className="text-2xl font-serif font-bold text-gray-900 mb-4">
                                    No Crisis Updates
                                </h3>
                                <p className="text-gray-600 max-w-2xl mx-auto leading-relaxed">
                                    The conference is currently stable. Crisis updates will appear here 
                                    when urgent situations develop that require immediate diplomatic response.
                                </p>
                            </motion.div>
                        )}
                    </div>
                )}
            </div>
        </div>
    </ProtectedRoute>
  )
}

export default Page;
