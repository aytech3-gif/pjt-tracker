import React, { useEffect, useState } from 'react';
import { Newspaper, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface NewsArticle {
  title: string;
  description: string;
  url: string;
}

interface NewsSectionProps {
  query: string;
  hasResults: boolean;
}

const NewsSection: React.FC<NewsSectionProps> = ({ query, hasResults }) => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query || !hasResults) {
      setArticles([]);
      return;
    }

    const fetchNews = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('news-search', {
          body: { query },
        });

        if (!error && data?.success) {
          setArticles(data.articles || []);
        }
      } catch (e) {
        console.error('News fetch error:', e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNews();
  }, [query, hasResults]);

  if (!hasResults || (!isLoading && articles.length === 0)) return null;

  return (
    <div className="mx-auto max-w-3xl px-6 pb-6">
      <div className="flex items-center gap-2 mb-3">
        <Newspaper className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-display text-xs text-muted-foreground uppercase tracking-wider">
          관련 뉴스
        </h3>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-4">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          <span className="font-data text-xs text-muted-foreground">뉴스 검색 중...</span>
        </div>
      ) : (
        <div className="space-y-1.5">
          {articles.map((article, idx) => (
            <a
              key={idx}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 rounded-md border border-border bg-card p-3 transition-all hover:border-foreground"
            >
              <div className="min-w-0 flex-1">
                <p className="font-display text-xs text-foreground line-clamp-1 group-hover:underline">
                  {article.title}
                </p>
                {article.description && (
                  <p className="mt-0.5 font-data text-[10px] text-muted-foreground line-clamp-1">
                    {article.description}
                  </p>
                )}
              </div>
              <ExternalLink className="mt-0.5 h-3 w-3 flex-shrink-0 text-muted-foreground group-hover:text-foreground" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default NewsSection;
