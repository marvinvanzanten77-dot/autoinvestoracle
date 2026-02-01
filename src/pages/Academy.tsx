import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { AiTutorModal } from '../components/AiTutorModal';
import { academyCurriculum, type AcademyLevel, type AcademyModule } from '../data/academyCurriculum';

type TabType = 'beginner' | 'intermediate' | 'expert';

interface ModuleProgress {
  [moduleId: string]: boolean;
}

interface BadgeEarned {
  [badgeId: string]: boolean;
}

export function Academy() {
  const [activeTab, setActiveTab] = useState<TabType>('beginner');
  const [selectedModule, setSelectedModule] = useState<AcademyModule | null>(null);
  const [isTutorOpen, setIsTutorOpen] = useState(false);
  const [progress, setProgress] = useState<ModuleProgress>({});
  const [badges, setBadges] = useState<BadgeEarned>({});
  const [loading, setLoading] = useState(true);

  // Load progress from server
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const res = await fetch('/api/academy/progress');
        if (res.ok) {
          const data = (await res.json()) as { progress: ModuleProgress; badges: BadgeEarned };
          setProgress(data.progress);
          setBadges(data.badges);
        }
      } catch (err) {
        console.error('Error loading progress:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProgress();
  }, []);

  const modules = academyCurriculum.filter((m) => m.level === activeTab);
  const completedCount = modules.filter((m) => progress[m.id]).length;
  const progressPercent = Math.round((completedCount / modules.length) * 100);

  const handleCompleteModule = async (moduleId: string) => {
    try {
      const res = await fetch('/api/academy/complete-module', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId })
      });

      if (res.ok) {
        const data = (await res.json()) as { progress: ModuleProgress; badges: BadgeEarned; newBadge?: string };
        setProgress(data.progress);
        setBadges(data.badges);

        // Show badge notification if earned
        if (data.newBadge) {
          const badge = academyCurriculum.find((m) => m.id === data.newBadge)?.badge;
          if (badge) {
            alert(`🎉 Badge earned: ${badge.name}!`);
          }
        }
      }
    } catch (err) {
      console.error('Error completing module:', err);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Laden...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card title="Academy" subtitle="Leer crypto in jouw tempo met AI ondersteuning">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Kies je niveau en werk de modules stap voor stap af. Verdien badges voor elk voltooid thema.
          </p>

          {/* Tab Navigation */}
          <div className="flex gap-2 flex-wrap">
            {(['beginner', 'intermediate', 'expert'] as const).map((level) => (
              <button
                key={level}
                onClick={() => {
                  setActiveTab(level);
                  setSelectedModule(null);
                }}
                className={`pill px-4 py-2 font-medium transition ${
                  activeTab === level
                    ? 'bg-primary text-white'
                    : 'border border-slate-200 dark:border-slate-600 bg-white/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
                }`}
              >
                {level === 'beginner' && '🌱 Beginner'}
                {level === 'intermediate' && '📈 Intermediate'}
                {level === 'expert' && '🎓 Expert'}
              </button>
            ))}
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-slate-900 dark:text-slate-100">Voortgang niveau</span>
              <span className="text-slate-600 dark:text-slate-400">
                {completedCount} / {modules.length}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{progressPercent}% voltooid</p>
          </div>
        </div>
      </Card>

      {/* Module detail view */}
      {selectedModule ? (
        <Card title={selectedModule.title} subtitle={selectedModule.description}>
          <div className="space-y-6">
            {/* Badge preview */}
            <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className={`text-4xl ${selectedModule.badge.color} p-3 rounded-lg`}>
                {selectedModule.badge.icon}
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  {selectedModule.badge.name}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Verdien deze badge wanneer je deze module voltooit
                </p>
              </div>
            </div>

            {/* Lesson content */}
            <div className="space-y-4">
              {selectedModule.lessons.map((lesson, idx) => (
                <div key={idx} className="border-l-4 border-primary pl-4 space-y-2">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">{lesson.title}</h4>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{lesson.content}</p>
                  <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-400">
                    {lesson.keyPoints.map((point, pidx) => (
                      <li key={pidx} className="flex gap-2">
                        <span>•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* AI Chat Section */}
            <div className="space-y-2 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                💬 AI Tutor beschikbaar
              </p>
              <p className="text-xs text-blue-800 dark:text-blue-200">
                Stel vragen over deze module. De AI helpt met uitleg en verdieping.
              </p>
              <button
                onClick={() => setIsTutorOpen(true)}
                className="mt-2 pill bg-blue-600 text-white hover:bg-blue-700 px-3 py-1"
              >
                Start chat met AI Tutor
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              {!progress[selectedModule.id] ? (
                <button
                  onClick={() => handleCompleteModule(selectedModule.id)}
                  className="flex-1 pill bg-primary text-white hover:bg-primary/90 px-4 py-2 font-medium"
                >
                  ✓ Module afgerond
                </button>
              ) : (
                <div className="flex-1 pill bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-200 px-4 py-2 font-medium flex items-center justify-center gap-2">
                  <span>✓</span>
                  <span>Voltooid</span>
                </div>
              )}
              <button
                onClick={() => setSelectedModule(null)}
                className="pill border border-slate-200 dark:border-slate-600 bg-white/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 px-4 py-2"
              >
                Terug
              </button>
            </div>
          </div>
        </Card>
      ) : (
        /* Modules Grid */
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {activeTab === 'beginner' && '🌱 Basiskennis - 10 Modules'}
            {activeTab === 'intermediate' && '📈 Verdiepende Kennis - 10 Modules'}
            {activeTab === 'expert' && '🎓 Expert Tier - 10 Modules'}
          </h2>

          <div className="grid gap-3 md:grid-cols-2">
            {modules.map((module) => {
              const isCompleted = progress[module.id];
              const isBadgeEarned = badges[module.id];

              return (
                <button
                  key={module.id}
                  onClick={() => setSelectedModule(module)}
                  className={`p-4 rounded-xl border-2 text-left transition ${
                    isCompleted
                      ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950'
                      : 'border-slate-200 dark:border-slate-600 bg-white/70 dark:bg-slate-800/70 hover:border-primary dark:hover:border-primary'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{module.badge.icon}</span>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                          {module.title}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                        {module.description}
                      </p>
                    </div>
                    {isCompleted && (
                      <div className="flex flex-col items-center gap-1">
                        <div className="text-2xl">✓</div>
                        {isBadgeEarned && (
                          <div className="text-xs font-medium text-green-700 dark:text-green-300">
                            Badge
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Badges section */}
      <Card title="Je Badges" subtitle="Verdiene badges voor elke voltooid module">
        <div className="grid gap-3 md:grid-cols-4">
          {modules.map((module) => {
            const isEarned = badges[module.id];
            return (
              <div
                key={module.id}
                className={`p-4 rounded-lg text-center transition ${
                  isEarned
                    ? `${module.badge.color} text-white`
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }`}
              >
                <div className="text-3xl mb-2">{module.badge.icon}</div>
                <p className="text-xs font-semibold line-clamp-2">{module.badge.name}</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* AI Tutor Modal */}
      {selectedModule && (
        <AiTutorModal
          isOpen={isTutorOpen}
          module={selectedModule}
          onClose={() => setIsTutorOpen(false)}
        />
      )}
    </div>
  );
}
