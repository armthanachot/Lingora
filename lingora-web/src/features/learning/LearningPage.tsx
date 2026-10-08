import { useEffect, useState, type ReactNode } from 'react';
import { courseApi, type Course, type CourseOutline } from '../courses';
import { enrollmentApi, type Enrollment } from '../enrollments';
import { LessonPlayer } from '../lessons/LessonPlayer';
import { BrandMark } from '../../components/BrandMark';

function courseLearningSummary(outline: CourseOutline) {
  const lessons = outline.modules.flatMap(module => module.lessons);
  const completed = lessons.filter(lesson => lesson.progress?.status === 'completed').length;
  return {
    total: lessons.length,
    completed,
    percent: lessons.length ? Math.round(lessons.reduce((sum, lesson) => sum + (lesson.progress?.percent ?? 0), 0) / lessons.length) : 0,
    next: lessons.find(lesson => lesson.progress?.status === 'in_progress')
      ?? lessons.find(lesson => lesson.progress?.status !== 'completed'),
  };
}

export function LearningPage({ accountSlot, isAdmin }: { accountSlot: ReactNode; isAdmin: boolean }) {
  const route = window.location.hash.slice(1).split('/');
  const courseId = route[1];
  const lessonId = route[2] === 'lessons' ? route[3] : undefined;
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [outline, setOutline] = useState<CourseOutline | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [myCourses, setMyCourses] = useState(false);
  const [query, setQuery] = useState('');
  const [courseSummaries, setCourseSummaries] = useState<Record<string, ReturnType<typeof courseLearningSummary>>>({});
  const [loadingSummaries, setLoadingSummaries] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const request = courseId
      ? courseApi.outline(courseId).then(data => { if (!cancelled) setOutline(data); })
      : Promise.all([courseApi.list(), enrollmentApi.list()]).then(([catalog, mine]) => {
        if (!cancelled) { setCourses(catalog); setEnrollments(mine); }
      });
    void request.catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [courseId, retry]);

  useEffect(() => {
    if (!myCourses || courseId || !enrollments.length) return;
    let cancelled = false;
    setLoadingSummaries(true);
    void Promise.allSettled(enrollments.map(enrollment => courseApi.outline(enrollment.courseId)))
      .then(results => {
        if (cancelled) return;
        const summaries: typeof courseSummaries = {};
        results.forEach(result => {
          if (result.status === 'fulfilled') summaries[result.value.course.id] = courseLearningSummary(result.value);
        });
        setCourseSummaries(summaries);
        setLoadingSummaries(false);
      });
    return () => { cancelled = true; };
  }, [myCourses, courseId, enrollments]);

  async function startLesson(id: string) {
    if (!outline || busy) return;
    setBusy(true);
    setError('');
    try {
      await enrollmentApi.enroll(outline.course.id);
      window.location.hash = `courses/${outline.course.id}/lessons/${id}`;
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  const lessons = outline?.modules.flatMap(module => module.lessons) ?? [];
  const completed = lessons.filter(lesson => lesson.progress?.status === 'completed').length;
  const percent = lessons.length ? Math.round(lessons.reduce((sum, lesson) => sum + (lesson.progress?.percent ?? 0), 0) / lessons.length) : 0;
  const recommended = lessons.find(lesson => lesson.progress?.status === 'in_progress')
    ?? lessons.find(lesson => lesson.progress?.status !== 'completed') ?? lessons[0];
  const currentIndex = lessons.findIndex(lesson => lesson.id === lessonId);
  const nextLesson = lessons[currentIndex + 1];
  const courseHash = `#courses/${courseId}`;

  return (
    <div className="learning-page">
      <header className="site-header">
        <a className="brand" href="#app"><BrandMark /><span>Lingora</span></a>
        <nav className="site-nav" aria-label="Learning navigation"><a href="#app">Explore</a><a href="#courses" aria-current="page">Courses</a></nav>
        <div className="account-slot">{accountSlot}</div>
      </header>
      <div className="learning-content" data-speech-lang={outline?.course.languageCode}>
        <nav className="learning-breadcrumb" aria-label="Breadcrumb"><a href="#courses">Courses</a>{outline && <><span>/</span><a href={courseHash}>{outline.course.title}</a></>}{lessonId && <><span>/</span><span>{lessons.find(lesson => lesson.id === lessonId)?.title ?? 'Lesson'}</span></>}</nav>
        {loading ? <p role="status">Loading your learning journey…</p> : error && !outline && !courses.length ? <div role="alert" className="learning-notice"><p>{error}</p><button onClick={() => setRetry(value => value + 1)}>Try again</button><a href="#courses">Back to courses</a></div> : lessonId && outline ? (
          !lessons.some(lesson => lesson.id === lessonId) ? <p role="alert">This lesson is unavailable. <a href={courseHash}>Back to course</a></p>
          : !outline.enrollment ? <section className="learning-card"><h1>Start this course to save your progress</h1><button className="lesson-player-primary" disabled={busy} onClick={() => void startLesson(lessonId)}>{busy ? 'Starting…' : 'Start learning'}</button>{error && <p role="alert">{error}</p>}</section>
          : <><div className="learning-player-meta">{isAdmin && (!outline.course.isPublished || !lessons.find(lesson => lesson.id === lessonId)?.isPublished) && <p className="learning-notice">Admin preview · {outline.course.isPublished ? 'This lesson is still a draft.' : 'This course is still a draft.'}</p>}</div><LessonPlayer key={lessonId} lessonId={lessonId} onExit={() => { window.location.hash = courseHash; }} onNext={nextLesson ? () => { window.location.hash = `courses/${courseId}/lessons/${nextLesson.id}`; } : undefined} nextLessonTitle={nextLesson?.title} /></>
        ) : outline ? (
          <>
            <section className="learning-course-hero">
              <span className="learning-eyebrow">{outline.course.level ?? 'Language course'}{!outline.course.isPublished && ' · Admin draft preview'}</span>
              <h1>{outline.course.title}</h1><p>{outline.course.description}</p>
              <div className="learning-course-overview">
                <div className="learning-course-stats"><span>{outline.modules.length} modules</span><span>{lessons.length} lessons</span><span>{completed} completed</span></div>
                {outline.enrollment && <div className="learning-progress"><label htmlFor="course-progress">Your progress · {percent}%</label><progress id="course-progress" max="100" value={percent} /></div>}
              </div>
              {recommended ? <button className="lesson-player-primary" disabled={busy} onClick={() => void startLesson(recommended.id)}>{busy ? 'Starting…' : completed === lessons.length ? 'Review course' : outline.enrollment ? 'Continue learning →' : 'Start learning →'}</button> : <p className="learning-notice">Lessons are being prepared. Check back soon.</p>}
              {error && <p role="alert" className="learning-notice">{error}</p>}
              {isAdmin && lessons.some(lesson => !lesson.isPublished) && <p className="learning-admin-note">You can try drafts as an admin. Learners see published courses and lessons.</p>}
            </section>
            {lessons.length > 0 && completed === lessons.length && <div className="learning-notice" role="status"><strong>✓ Course complete!</strong><p>You finished every available lesson. Come back anytime to practice again.</p></div>}
            <h2>Course outline</h2>
            <div className="learning-outline">{outline.modules.map((module, index) => <details className="learning-module" key={module.id} open={module.lessons.some(lesson => lesson.id === recommended?.id) || undefined}>
              <summary><span className="learning-module-number">{String(index + 1).padStart(2, '0')}</span><span><strong>{module.title}</strong><small>{module.lessons.filter(lesson => lesson.progress?.status === 'completed').length} / {module.lessons.length} lessons completed</small></span></summary>
              {module.description && <p>{module.description}</p>}
              {module.lessons.length ? module.lessons.map(lesson => <button className={'learning-lesson-row ' + (lesson.progress?.status === 'completed' ? 'is-completed' : lesson.progress?.status === 'in_progress' ? 'is-in-progress' : 'is-not-started') + (lesson.id === recommended?.id && lesson.progress?.status !== 'completed' ? ' is-recommended' : '')} key={lesson.id} disabled={busy} onClick={() => void startLesson(lesson.id)}><span className="learning-lesson-state" aria-hidden="true">{lesson.progress?.status === 'completed' ? '✓' : lesson.progress?.status === 'in_progress' ? '◐' : '○'}</span><span><strong>{lesson.title}</strong>{lesson.id === recommended?.id && lesson.progress?.status !== 'completed' && <small className="learning-next-hint">Up next</small>}{lesson.description && <small>{lesson.description}</small>}</span><span className="learning-lesson-label">{!lesson.isPublished && <em>Draft · </em>}{lesson.progress?.status === 'completed' ? 'Review' : lesson.progress?.status === 'in_progress' ? `Continue · ${lesson.progress.percent}%` : 'Start'} →</span></button>) : <p>No published lessons yet.</p>}
            </details>)}</div>
          </>
        ) : (
          <><section className="learning-course-hero is-catalog"><span className="learning-eyebrow">{myCourses ? 'A little practice, every day' : 'Find your next language journey'}</span><h1>{myCourses ? 'Pick up where you left off.' : 'Explore courses'}</h1><p>{myCourses ? 'Your progress and next lessons, all in one place.' : 'Choose a course and learn at your own pace.'}</p></section>
            <div className="learning-catalog-tools"><div><button aria-pressed={!myCourses} onClick={() => setMyCourses(false)}>All courses</button><button aria-pressed={myCourses} onClick={() => setMyCourses(true)}>My learning</button></div><input aria-label="Search courses" placeholder="Search courses…" value={query} onChange={event => setQuery(event.target.value)} /></div>
            {error && <p role="alert">{error}</p>}
            <div className="learning-catalog">{courses.filter(course => (!myCourses || enrollments.some(enrollment => enrollment.courseId === course.id)) && `${course.title} ${course.description ?? ''}`.toLowerCase().includes(query.toLowerCase())).map(course => {
              const summary = myCourses ? courseSummaries[course.id] : undefined;
              const complete = Boolean(summary?.total && summary.completed === summary.total);
              return <a className="learning-card" key={course.id} href={`#courses/${course.id}`}>
                <span className="learning-eyebrow">{course.level ?? 'Language course'}{!course.isPublished && ' · Draft'}</span>
                <h2>{course.title}</h2><p>{course.description}</p>
                {myCourses && (summary ? <div className="learning-card-progress">
                  <span>{complete ? '✓ Course complete' : `${summary.completed} of ${summary.total} lessons completed`} · {summary.percent}%</span>
                  <progress aria-label={`${course.title} progress`} max="100" value={summary.percent} />
                  {summary.next && <span className="learning-card-next">Next: {summary.next.title}</span>}
                </div> : <small className="learning-card-next">{loadingSummaries ? 'Loading progress…' : 'Open course to see your progress.'}</small>)}
                <strong>{complete ? 'Review course' : enrollments.some(enrollment => enrollment.courseId === course.id) ? 'Continue learning' : 'View course'} →</strong>
              </a>;
            })}</div>
            {!courses.some(course => (!myCourses || enrollments.some(enrollment => enrollment.courseId === course.id)) && `${course.title} ${course.description ?? ''}`.toLowerCase().includes(query.toLowerCase())) && <p className="learning-notice">{myCourses ? 'No matching courses in your learning list. Browse all courses to get started.' : 'No matching courses available yet.'}</p>}
          </>
        )}
      </div>
    </div>
  );
}
