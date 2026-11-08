import { Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Empty } from './components/ui'
import { githubUrl } from './lib/links'
import { Login, OAuthCallback } from './pages/auth'
import { Home } from './pages/Home'
import { SearchPage } from './pages/Search'
import { Notifications } from './pages/Notifications'
import { OpenUrl, Settings } from './pages/Settings'
import { UserPage } from './pages/UserPage'
import { RepoLayout } from './pages/repo/RepoLayout'
import { BlobView, CodeView } from './pages/repo/Code'
import { IssueList, IssueView, NewIssue } from './pages/repo/Issues'
import { PullView } from './pages/repo/Pull'
import { CommitsList, CommitView } from './pages/repo/Commits'
import { ActionsList, JobLog, RunView } from './pages/repo/Actions'
import { Releases } from './pages/repo/Releases'

function Unsupported() {
  const { pathname, search } = useLocation()
  return (
    <Empty>
      This page isn't available in FinerGithub yet.{' '}
      <a href={githubUrl(pathname + search)} target="_blank" rel="noreferrer">
        Open it on github.com
      </a>
    </Empty>
  )
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="oauth/callback" element={<OAuthCallback />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="settings" element={<Settings />} />
        <Route path="open" element={<OpenUrl />} />
        <Route path=":owner" element={<UserPage />} />
        <Route path=":owner/:repo" element={<RepoLayout />}>
          <Route index element={<CodeView />} />
          <Route path="tree/:ref/*" element={<CodeView />} />
          <Route path="blob/:ref/*" element={<BlobView />} />
          <Route path="issues" element={<IssueList kind="issue" />} />
          <Route path="issues/new" element={<NewIssue />} />
          <Route path="issues/:number" element={<IssueView />} />
          <Route path="pulls" element={<IssueList kind="pr" />} />
          <Route path="pull/:number" element={<PullView tab="conversation" />} />
          <Route path="pull/:number/commits" element={<PullView tab="commits" />} />
          <Route path="pull/:number/files" element={<PullView tab="files" />} />
          <Route path="commits" element={<CommitsList />} />
          <Route path="commits/:ref/*" element={<CommitsList />} />
          <Route path="commit/:sha" element={<CommitView />} />
          <Route path="actions" element={<ActionsList />} />
          <Route path="actions/runs/:runId" element={<RunView />} />
          <Route path="actions/runs/:runId/job/:jobId" element={<JobLog />} />
          <Route path="actions/runs/:runId/attempts/:attempt" element={<RunView />} />
          <Route path="releases" element={<Releases />} />
          <Route path="*" element={<Unsupported />} />
        </Route>
        <Route path="*" element={<Unsupported />} />
      </Route>
    </Routes>
  )
}
