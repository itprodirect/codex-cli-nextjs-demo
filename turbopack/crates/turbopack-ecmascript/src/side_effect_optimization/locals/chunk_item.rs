use anyhow::Result;
use turbo_tasks::{ResolvedVc, Vc};
use turbopack_core::{
    chunk::{AsyncModuleInfo, ChunkItem, ChunkType, ChunkingContext},
    ident::AssetIdent,
    module::Module,
    module_graph::ModuleGraph,
};

use super::module::EcmascriptModuleLocalsModule;
use crate::{
    chunk::{
        EcmascriptChunkItem, EcmascriptChunkItemContent, EcmascriptChunkPlaceable,
        EcmascriptChunkType,
    },
    EcmascriptModuleContent, EcmascriptModuleContentOptions,
};

/// The chunk item for [EcmascriptModuleLocalsModule].
#[turbo_tasks::value(shared)]
pub struct EcmascriptModuleLocalsChunkItem {
    pub(super) module: ResolvedVc<EcmascriptModuleLocalsModule>,
    pub(super) module_graph: ResolvedVc<ModuleGraph>,
    pub(super) chunking_context: ResolvedVc<Box<dyn ChunkingContext>>,
}

#[turbo_tasks::value_impl]
impl EcmascriptChunkItem for EcmascriptModuleLocalsChunkItem {
    #[turbo_tasks::function]
    fn content(self: Vc<Self>) -> Vc<EcmascriptChunkItemContent> {
        panic!("content() should never be called");
    }

    #[turbo_tasks::function]
    async fn content_with_async_module_info(
        &self,
        async_module_info: Option<ResolvedVc<AsyncModuleInfo>>,
    ) -> Result<Vc<EcmascriptChunkItemContent>> {
        let module = self.module.await?;
        let chunking_context = self.chunking_context;
        let module_graph = self.module_graph;
        let exports = self.module.get_exports().to_resolved().await?;
        let original_module = module.module;
        let parsed = original_module.parse().to_resolved().await?;

        let analyze = original_module.analyze();
        let analyze_result = analyze.await?;
        let async_module_options = analyze_result
            .async_module
            .module_options(async_module_info.map(|info| *info));

        let module_type_result = *original_module.determine_module_type().await?;
        let generate_source_map = *chunking_context
            .reference_module_source_maps(*ResolvedVc::upcast(self.module))
            .await?;

        let content = EcmascriptModuleContent::new(EcmascriptModuleContentOptions {
            parsed,
            ident: self.module.ident().to_resolved().await?,
            specified_module_type: module_type_result.module_type,
            module_graph,
            chunking_context,
            references: analyze.local_references().to_resolved().await?,
            esm_references: analyze_result.esm_local_references,
            code_generation: analyze_result.code_generation,
            async_module: analyze_result.async_module,
            generate_source_map,
            original_source_map: analyze_result.source_map,
            exports,
            async_module_info,
        });

        Ok(EcmascriptChunkItemContent::new(
            content,
            *chunking_context,
            *original_module.await?.options,
            async_module_options,
        ))
    }
}

#[turbo_tasks::value_impl]
impl ChunkItem for EcmascriptModuleLocalsChunkItem {
    #[turbo_tasks::function]
    fn asset_ident(&self) -> Vc<AssetIdent> {
        self.module.ident()
    }

    #[turbo_tasks::function]
    fn chunking_context(&self) -> Vc<Box<dyn ChunkingContext>> {
        *ResolvedVc::upcast(self.chunking_context)
    }

    #[turbo_tasks::function]
    async fn ty(&self) -> Result<Vc<Box<dyn ChunkType>>> {
        Ok(Vc::upcast(
            Vc::<EcmascriptChunkType>::default().resolve().await?,
        ))
    }

    #[turbo_tasks::function]
    fn module(&self) -> Vc<Box<dyn Module>> {
        *ResolvedVc::upcast(self.module)
    }
}
