export interface ProjectRepository<TProject> {
  save(project:TProject):Promise<void>;
  load(id:string):Promise<TProject|undefined>;
  clear():Promise<void>;
}

export type RepositoryFactory<TProject> = () => ProjectRepository<TProject>;
